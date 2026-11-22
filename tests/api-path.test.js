/**
 * The data root and the file names built from request values.
 *
 * A route value may name one user's file and nothing else: no dot, no separator, no shared store. The
 * data root is `GRND_DATA_DIR` when set and `<repo>/data` otherwise, and every store follows it.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const REPO_DRAFTS = path.join(ROOT, 'data', 'workout-drafts.json');
const TOKEN = '100000000:path-test-token';
const OWN = '1001';

const SHARED_STORES = [
  'user-profiles',
  'workout-sessions',
  'workout-drafts',
  'training-plans',
  'weekly-targets',
  'exercise-catalogue',
  'exercise-taxonomy',
  'equipment',
  'pillars'
];

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

function initData(userId) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAH-path',
    user: JSON.stringify({ id: Number(userId), first_name: 'Test' })
  });
  const checkString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(checkString).digest('hex'));
  return params.toString();
}

const auth = () => ({ Authorization: `tma ${initData(OWN)}` });

async function call(baseUrl, method, urlPath, { body, headers = {} } = {}) {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: {
      ...auth(),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual'
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, headers: res.headers, text, json };
}

/** A request whose path is sent exactly as written: fetch and URL() normalise `..` away. */
function rawRequest(port, rawPath, headers = auth()) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method: 'GET', path: rawPath, headers }, (res) => {
      let text = '';
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    req.end();
  });
}

/** A server and a data root under a temp directory. `createRoot: false` leaves the root missing. */
async function fixture(t, { dataDir, createRoot = true, seed = {}, useRepoRoot = false } = {}) {
  let parent = null;
  if (dataDir === undefined && !useRepoRoot) {
    parent = fs.mkdtempSync(path.join(os.tmpdir(), 'grnd-path-'));
    dataDir = path.join(parent, 'root');
  }
  if (dataDir !== undefined && createRoot) {
    fs.mkdirSync(dataDir, { recursive: true });
    for (const [name, content] of Object.entries(seed)) {
      fs.writeFileSync(path.join(dataDir, name), JSON.stringify(content, null, 2));
    }
  }

  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = startServer(port, { GRND_DATA_DIR: useRepoRoot ? undefined : dataDir });

  t.after(async () => {
    await stopServer(child);
    if (parent) fs.rmSync(parent, { recursive: true, force: true });
  });

  await waitForHealth(baseUrl, child);
  return { baseUrl, port, dataDir };
}

test('AC10 a userId that is too long, has a dot or a space answers 400 and creates nothing', async (t) => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'grnd-path-'));
  const dataDir = path.join(parent, 'root');
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));

  const { baseUrl } = await fixture(t, { dataDir, createRoot: false });

  assert.equal((await call(baseUrl, 'GET', `/api/workout-data/${'a'.repeat(65)}`)).status, 400);
  assert.equal((await call(baseUrl, 'GET', '/api/workout-data/foo.bar')).status, 400);
  assert.equal((await call(baseUrl, 'GET', '/api/workout-data/foo%20bar')).status, 400);
  assert.equal((await call(baseUrl, 'POST', '/api/workout-data/foo.bar', { body: {} })).status, 400);
  // An empty value does not reach its route; it still must answer 400, not 404.
  assert.equal((await call(baseUrl, 'GET', '/api/user-profile/')).status, 400);

  assert.equal(fs.existsSync(dataDir), false, 'no data root, directory or temp file was created');
});

test('AC11 a userId that names a shared store answers 400 and leaves the store', async (t) => {
  const seed = { 'workout-drafts.json': { [OWN]: { mode: 'sets', elapsed: 1, state: { marker: 'keep' }, savedAt: Date.now() } } };
  const { baseUrl, dataDir } = await fixture(t, { seed });
  const drafts = path.join(dataDir, 'workout-drafts.json');
  const before = fs.readFileSync(drafts, 'utf8');

  for (const name of SHARED_STORES) {
    assert.equal((await call(baseUrl, 'GET', `/api/workout-data/${name}`)).status, 400, name);
  }

  const write = await call(baseUrl, 'PUT', '/api/workout-draft/workout-drafts', { body: { state: { marker: 'x' } } });
  assert.equal(write.status, 400);
  assert.equal(fs.readFileSync(drafts, 'utf8'), before);
});

test('AC12 an encoded separator or dot segment answers 400 and reads nothing outside the root', async (t) => {
  const { port, dataDir } = await fixture(t, { seed: { 'server.js': 'not the real one' } });

  for (const rawPath of [
    '/api/workout-data/%2e%2e%2fserver.js',
    '/api/workout-data/..%2fserver.js',
    '/api/workout-data/%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    '/api/workout-data/foo%2Fbar',
    '/api/workout-data/foo%5Cbar'
  ]) {
    const res = await rawRequest(port, rawPath);
    assert.equal(res.status, 400, rawPath);
    assert.doesNotMatch(res.text, /GRND Telegram Mini App backend/);
  }

  // The store outside the root was never read, and the traversal name never became a file.
  assert.equal(fs.existsSync(path.join(dataDir, '..', 'server.js')), false);
  assert.deepEqual(fs.readdirSync(dataDir), ['server.js']);
});

test('AC22 /next refuses a target that is not a single-slash path and keeps a same-host one', async (t) => {
  const { port, baseUrl } = await fixture(t);

  assert.equal((await rawRequest(port, '/next')).status, 400);
  assert.equal((await rawRequest(port, '/next//evil.example/x')).status, 400);
  assert.equal((await rawRequest(port, '/next/%5C%5Cevil.example')).status, 400);
  assert.equal((await rawRequest(port, '/next/\\\\evil.example')).status, 400);

  const target = await call(baseUrl, 'GET', '/next/plans');
  assert.equal(target.status, 301);
  assert.equal(target.headers.get('location'), '/plans');

  // The app itself and /health stay public.
  assert.equal((await call(baseUrl, 'GET', '/health', { headers: { Authorization: undefined } })).status, 200);
});

test('AC35 GRND_DATA_DIR moves every store and leaves the repository data/ untouched', async (t) => {
  const repoBefore = fs.existsSync(REPO_DRAFTS) ? fs.readFileSync(REPO_DRAFTS, 'utf8') : null;
  const { baseUrl, dataDir } = await fixture(t);

  const res = await call(baseUrl, 'PUT', `/api/workout-draft/${OWN}`, { body: { state: { marker: 'temp-root' } } });
  assert.equal(res.status, 200);

  const written = JSON.parse(fs.readFileSync(path.join(dataDir, 'workout-drafts.json'), 'utf8'));
  assert.equal(written[OWN].state.marker, 'temp-root');

  const repoAfter = fs.existsSync(REPO_DRAFTS) ? fs.readFileSync(REPO_DRAFTS, 'utf8') : null;
  assert.equal(repoAfter, repoBefore, 'the repository data/ was not touched');
});

test('AC36 without GRND_DATA_DIR the stores live in <repo>/data', async (t) => {
  const before = fs.existsSync(REPO_DRAFTS) ? fs.readFileSync(REPO_DRAFTS, 'utf8') : null;
  t.after(() => {
    if (before === null) fs.rmSync(REPO_DRAFTS, { force: true });
    else fs.writeFileSync(REPO_DRAFTS, before);
  });

  const { baseUrl } = await fixture(t, { useRepoRoot: true });

  const res = await call(baseUrl, 'PUT', `/api/workout-draft/${OWN}`, { body: { state: { marker: 'repo-root' } } });
  assert.equal(res.status, 200);

  const stored = JSON.parse(fs.readFileSync(REPO_DRAFTS, 'utf8'));
  assert.equal(stored[OWN].state.marker, 'repo-root');
});
