/**
 * Who is calling: one verified Telegram principal per /api request.
 *
 * Every case here starts a real server with a temp data root, so nothing under the repository's data/
 * is read or written. The initData is signed the way Telegram signs it, with a test bot token.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const TOKEN = '100000000:authz-test-token';
const OTHER_TOKEN = '100000000:somebody-elses-token';
const OWN = '1001';
const OTHER = '2002';

/** Ask the OS for a free port, then release it for the server to bind. */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function startServer(port, extraEnv) {
  const env = { ...process.env, PORT: String(port), GRND_TELEGRAM_BOT_TOKEN: TOKEN, ...extraEnv };
  for (const key of Object.keys(env)) {
    if (env[key] === undefined) delete env[key];
  }
  return spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

async function waitForHealth(baseUrl, child, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.stdout.resume();

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited with code ${child.exitCode}: ${stderr}`);
    }
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`server did not answer /health in time: ${stderr}`);
}

function stopServer(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve();
    const killTimer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* already gone */ }
    }, 5000);
    killTimer.unref();
    child.once('exit', () => {
      clearTimeout(killTimer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

/** A signed initData string, built the way Telegram builds it. */
function initData(userId, { token = TOKEN, authDate } = {}) {
  const params = new URLSearchParams({
    auth_date: String(authDate === undefined ? Math.floor(Date.now() / 1000) : authDate),
    query_id: 'AAH-authz',
    user: JSON.stringify({ id: Number(userId), first_name: 'Test' })
  });
  const checkString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(checkString).digest('hex'));
  return params.toString();
}

async function call(baseUrl, method, urlPath, { as = OWN, token = TOKEN, authDate, body, authorization } = {}) {
  const headers = {};
  if (authorization !== undefined) headers.Authorization = authorization;
  else if (as !== null) headers.Authorization = `tma ${initData(as, { token, authDate })}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual'
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, headers: res.headers, text, json };
}

/** A data root and a server pointed at it; the root is removed afterwards. */
async function fixture(t, { seed = {}, env = {} } = {}) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'grnd-authz-'));
  const dataDir = path.join(parent, 'root');
  fs.mkdirSync(dataDir, { recursive: true });
  for (const [name, content] of Object.entries(seed)) {
    fs.writeFileSync(path.join(dataDir, name), JSON.stringify(content, null, 2));
  }

  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = startServer(port, { GRND_DATA_DIR: dataDir, ...env });

  t.after(async () => {
    await stopServer(child);
    fs.rmSync(parent, { recursive: true, force: true });
  });

  await waitForHealth(baseUrl, child);
  return { baseUrl, dataDir };
}

const session = (id, userId) => ({
  id,
  userId,
  date: '2026-01-01T00:00:00.000Z',
  completedExercises: [],
  totalSets: 0,
  totalVolume: 0
});

test('AC1 a request without a valid signed initData answers 401 and reads no store', async (t) => {
  const { baseUrl, dataDir } = await fixture(t);

  assert.equal((await call(baseUrl, 'GET', '/api/me', { as: null })).status, 401);

  const garbage = await call(baseUrl, 'GET', '/api/me', { authorization: 'tma not-a-signature' });
  assert.equal(garbage.status, 401);

  const expired = await call(baseUrl, 'GET', '/api/me', {
    authDate: Math.floor(Date.now() / 1000) - 25 * 60 * 60
  });
  assert.equal(expired.status, 401);

  const foreignToken = await call(baseUrl, 'GET', '/api/me', { authorization: `tma ${initData(OWN, { token: OTHER_TOKEN })}` });
  assert.equal(foreignToken.status, 401);

  // Nothing was created or read: the root still holds only what the fixture seeded (nothing).
  assert.deepEqual(fs.readdirSync(dataDir), []);
});

test('AC2 /api/workout-data for another id answers 404 and creates no plan file', async (t) => {
  const { baseUrl, dataDir } = await fixture(t);

  const get = await call(baseUrl, 'GET', `/api/workout-data/${OTHER}`);
  assert.equal(get.status, 404);

  const post = await call(baseUrl, 'POST', `/api/workout-data/${OTHER}`, {
    body: { id: 'x', name: 'x', start_date: '2026-01-01T00:00:00.000Z', weeks: [] }
  });
  assert.equal(post.status, 404);

  assert.equal(fs.existsSync(path.join(dataDir, `${OTHER}.json`)), false);
});

test('AC3 /api/user-profile for another id answers 404 on GET, POST and DELETE and leaves the file', async (t) => {
  const seed = { 'user-profiles.json': { [OWN]: { userId: OWN, bodyweight: 75 }, [OTHER]: { userId: OTHER, bodyweight: 80 } } };
  const { baseUrl, dataDir } = await fixture(t, { seed });
  const profiles = path.join(dataDir, 'user-profiles.json');
  const before = fs.readFileSync(profiles, 'utf8');

  assert.equal((await call(baseUrl, 'GET', `/api/user-profile/${OTHER}`)).status, 404);
  assert.equal((await call(baseUrl, 'POST', `/api/user-profile/${OTHER}`, {
    body: { userId: OTHER, bodyweight: 90 }
  })).status, 404);
  assert.equal((await call(baseUrl, 'DELETE', `/api/user-profile/${OTHER}`)).status, 404);

  assert.equal(fs.readFileSync(profiles, 'utf8'), before);
});

test('AC4 /api/workout-draft for another id answers 404 on GET, PUT and DELETE and leaves the file', async (t) => {
  const now = Date.now();
  const seed = {
    'workout-drafts.json': {
      [OWN]: { mode: 'sets', elapsed: 1, state: { marker: 'own' }, savedAt: now },
      [OTHER]: { mode: 'sets', elapsed: 1, state: { marker: 'other' }, savedAt: now }
    }
  };
  const { baseUrl, dataDir } = await fixture(t, { seed });
  const drafts = path.join(dataDir, 'workout-drafts.json');
  const before = fs.readFileSync(drafts, 'utf8');

  assert.equal((await call(baseUrl, 'GET', `/api/workout-draft/${OTHER}`)).status, 404);
  assert.equal((await call(baseUrl, 'PUT', `/api/workout-draft/${OTHER}`, { body: { state: { marker: 'changed' } } })).status, 404);
  assert.equal((await call(baseUrl, 'DELETE', `/api/workout-draft/${OTHER}`)).status, 404);

  assert.equal(fs.readFileSync(drafts, 'utf8'), before);
});

test('AC5 workout-sessions, muscle-volume, pillars and suggestions for another id answer 404', async (t) => {
  const seed = {
    'workout-sessions.json': { schema: 2, sessions: [session('s-own', OWN), session('s-other', OTHER)] }
  };
  const { baseUrl } = await fixture(t, { seed });

  for (const route of ['workout-sessions', 'muscle-volume', 'pillars', 'suggestions']) {
    const res = await call(baseUrl, 'GET', `/api/${route}/${OTHER}`);
    assert.equal(res.status, 404, `${route} hid the other account`);
  }

  // The caller's own journal is still answered.
  assert.equal((await call(baseUrl, 'GET', `/api/workout-sessions/${OWN}`)).status, 200);
});

test('AC6 another account\'s workout-session answers 404 on GET and DELETE and leaves the journal', async (t) => {
  const seed = {
    'workout-sessions.json': { schema: 2, sessions: [session('s-own', OWN), session('s-other', OTHER)] }
  };
  const { baseUrl, dataDir } = await fixture(t, { seed });
  const journal = path.join(dataDir, 'workout-sessions.json');
  const before = fs.readFileSync(journal, 'utf8');

  assert.equal((await call(baseUrl, 'GET', '/api/workout-session/s-other')).status, 404);
  assert.equal((await call(baseUrl, 'DELETE', '/api/workout-session/s-other')).status, 404);

  assert.equal(fs.readFileSync(journal, 'utf8'), before);
  // The caller's own session is still readable.
  assert.equal((await call(baseUrl, 'GET', '/api/workout-session/s-own')).status, 200);
});

test('AC7 the plan list answers only the plans that carry the caller id', async (t) => {
  const seed = {
    'training-plans.json': [
      { id: 'p-own', userId: OWN, name: 'Mine' },
      { id: 'p-other', userId: OTHER, name: 'Theirs' },
      { id: 'p-legacy', name: 'Nobody' }
    ]
  };
  const { baseUrl } = await fixture(t, { seed });

  const res = await call(baseUrl, 'GET', '/api/training-plans');
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.map((plan) => plan.id), ['p-own']);
});

test('AC8 PUT and DELETE of another account\'s plan answer 404 and leave it unchanged', async (t) => {
  const seed = {
    'training-plans.json': [
      { id: 'p-own', userId: OWN, name: 'Mine' },
      { id: 'p-other', userId: OTHER, name: 'Theirs' }
    ]
  };
  const { baseUrl, dataDir } = await fixture(t, { seed });
  const plans = path.join(dataDir, 'training-plans.json');
  const before = fs.readFileSync(plans, 'utf8');

  assert.equal((await call(baseUrl, 'PUT', '/api/training-plans/p-other', { body: { name: 'Renamed' } })).status, 404);
  assert.equal((await call(baseUrl, 'DELETE', '/api/training-plans/p-other')).status, 404);

  assert.equal(fs.readFileSync(plans, 'utf8'), before);

  // The caller can still change a plan of its own.
  const own = await call(baseUrl, 'PUT', '/api/training-plans/p-own', { body: { name: 'Renamed' } });
  assert.equal(own.status, 200);
  assert.equal(own.json.name, 'Renamed');
});

test('AC9 /api/me answers the verified user id and ignores a spoofed one', async (t) => {
  const { baseUrl } = await fixture(t);

  const res = await call(baseUrl, 'GET', `/api/me?userId=${OTHER}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { userId: OWN });

  const other = await call(baseUrl, 'GET', '/api/me', { as: OTHER });
  assert.deepEqual(other.json, { userId: OTHER });
});

test('AC37 initData is verified with the configured bot token', async (t) => {
  const { baseUrl } = await fixture(t);

  assert.equal((await call(baseUrl, 'GET', '/api/me', { as: OWN, token: TOKEN })).status, 200);
  assert.equal((await call(baseUrl, 'GET', '/api/me', { as: OWN, token: OTHER_TOKEN })).status, 401);
});

test('AC38 without a bot token every /api route answers 503 instead of data', async (t) => {
  // An empty string, not a deleted key: dotenv never overrides a key that is already defined, so the
  // repository's own .env cannot smuggle a working token into this case.
  const { baseUrl } = await fixture(t, { env: { GRND_TELEGRAM_BOT_TOKEN: '' } });

  const me = await call(baseUrl, 'GET', '/api/me', { authorization: `tma ${initData(OWN)}` });
  assert.equal(me.status, 503);

  const plans = await call(baseUrl, 'GET', '/api/training-plans', { as: null });
  assert.equal(plans.status, 503);

  // /health stays public and unchanged.
  const health = await call(baseUrl, 'GET', '/health', { as: null });
  assert.equal(health.status, 200);
});
