const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

// Every bound the server puts on a request, answered over HTTP against a real process. The data root
// is a temp directory per launch, so nothing here touches the repository's data/.
const ROOT = path.join(__dirname, '..');
const UPLOADS = path.join(ROOT, 'uploads');
const createdFiles = [];

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

function tempParent() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'grnd-limits-'));
}

/** A data root that does not exist yet, under a temp parent: the server must create it. */
function pendingDataRoot() {
  const parent = tempParent();
  return { parent, root: path.join(parent, 'data') };
}

function cleanEnv() {
  const env = { ...process.env };
  delete env.TELEGRAM_SECRET_TOKEN;
  delete env.UNSPLASH_ACCESS_KEY;
  return env;
}

async function waitForHealth(baseUrl, child, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited with code ${child.exitCode}`);
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('server did not answer /health in time');
}

async function launch({ dataDir, env = {} }) {
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...cleanEnv(), ...env, PORT: String(port), GRND_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  child.stdout.on('data', (chunk) => { log += chunk.toString(); });
  child.stderr.on('data', (chunk) => { log += chunk.toString(); });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHealth(baseUrl, child);

  return {
    baseUrl,
    dataDir,
    logs: () => log,
    stop: () => new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      const force = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* already gone */ }
        resolve();
      }, 3000);
      child.once('exit', () => { clearTimeout(force); resolve(); });
      child.kill('SIGTERM');
    })
  };
}

async function withServer(options, body) {
  const server = await launch(options);
  try {
    return await body(server);
  } finally {
    await server.stop();
    if (options.cleanup !== false) fs.rmSync(path.dirname(options.dataDir), { recursive: true, force: true });
  }
}

function tomorrow() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

async function postJson(server, pathname, body) {
  return fetch(`${server.baseUrl}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function multipart({ filename, contentType, bytes = Buffer.from('grnd') }) {
  const boundary = '----grndlimits' + Math.random().toString(16).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\n`
    + `Content-Type: ${contentType}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    body: Buffer.concat([head, bytes, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}

async function upload(server, options) {
  const form = multipart(options);
  return fetch(`${server.baseUrl}/api/upload-image`, {
    method: 'POST',
    headers: { 'content-type': form.contentType },
    body: form.body
  });
}

function uploadsHeld() {
  return fs.existsSync(UPLOADS) ? fs.readdirSync(UPLOADS) : [];
}

function removeCreatedUploads() {
  for (const name of createdFiles.splice(0)) {
    fs.rmSync(path.join(UPLOADS, name), { force: true });
  }
}

function validSets(count) {
  return Array.from({ length: count }, () => ({ reps: 5, weight: 50 }));
}

function validSession(overrides = {}) {
  return {
    userId: 'limits-user',
    date: new Date().toISOString(),
    completedExercises: [{ exerciseId: 'squat', name: 'Squat', exercise_type: 'WEIGHTED', sets: validSets(1) }],
    ...overrides
  };
}

const shared = { parent: null, root: null, server: null };

test.before(async () => {
  shared.parent = tempParent();
  shared.root = path.join(shared.parent, 'data');
  shared.server = await launch({
    dataDir: shared.root,
    env: { UNSPLASH_ACCESS_KEY: 'unsplash-secret-value' }
  });
});

test.after(async () => {
  if (shared.server) await shared.server.stop();
  removeCreatedUploads();
  if (shared.parent) fs.rmSync(shared.parent, { recursive: true, force: true });
});

test('AC31 a data root the server creates carries mode 0700', async () => {
  const { parent, root } = pendingDataRoot();
  try {
    assert.equal(fs.existsSync(root), false, 'the root starts absent');
    await withServer({ dataDir: root }, async () => {
      const mode = fs.statSync(root).mode & 0o777;
      assert.equal(mode.toString(8), '700');
    });
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('AC13 durationWeeks outside 1..52 answers 400 and writes no plan', async () => {
  const store = path.join(shared.root, 'training-plans.json');
  fs.rmSync(store, { force: true });
  for (const durationWeeks of [0, -1, 53, 104, 2.5, '3']) {
    const res = await postJson(shared.server, '/api/training-plans', {
      name: 'Too long', startDate: tomorrow(), durationWeeks
    });
    assert.equal(res.status, 400, `durationWeeks ${JSON.stringify(durationWeeks)} is refused`);
  }
  assert.equal(fs.existsSync(store), false, 'the generation loop never reached the store');
});

test('AC14 the 51st plan and a merge past 52 weeks answer 400', async () => {
  const store = path.join(shared.root, 'training-plans.json');
  const seeded = Array.from({ length: 50 }, (_, index) => ({
    id: `seed-${index}`,
    name: `Seed ${index}`,
    startDate: tomorrow(),
    durationWeeks: 52,
    weeks: []
  }));
  fs.writeFileSync(store, JSON.stringify(seeded));

  const created = await postJson(shared.server, '/api/training-plans', {
    name: 'One too many', startDate: tomorrow(), durationWeeks: 1
  });
  assert.equal(created.status, 400, 'an account holds at most 50 plans');
  assert.equal(JSON.parse(fs.readFileSync(store, 'utf8')).length, 50);

  const weeks = Array.from({ length: 53 }, (_, index) => ({
    id: `seed-0-w${index + 1}`, weekNumber: index + 1, days: []
  }));
  const merged = await fetch(`${shared.server.baseUrl}/api/training-plans/seed-0`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ weeks })
  });
  assert.equal(merged.status, 400, 'a plan holds at most 52 weeks');
  const stored = JSON.parse(fs.readFileSync(store, 'utf8'));
  assert.equal(stored[0].weeks.length, 0, 'the refused merge left the plan unchanged');
});

test('AC15 a session over 50 exercises, 50 sets or 2000 notes answers 400', async () => {
  const tooManyExercises = await postJson(shared.server, '/api/workout-session', validSession({
    completedExercises: Array.from({ length: 51 }, (_, index) => ({
      exerciseId: `squat-${index}`, name: 'Squat', exercise_type: 'WEIGHTED', sets: validSets(1)
    }))
  }));
  assert.equal(tooManyExercises.status, 400);

  const tooManySets = await postJson(shared.server, '/api/workout-session', validSession({
    completedExercises: [{ exerciseId: 'squat', name: 'Squat', exercise_type: 'WEIGHTED', sets: validSets(51) }]
  }));
  assert.equal(tooManySets.status, 400);

  const tooManyNotes = await postJson(shared.server, '/api/workout-session', validSession({
    notes: 'x'.repeat(2001)
  }));
  assert.equal(tooManyNotes.status, 400);

  const atTheLimit = await postJson(shared.server, '/api/workout-session', validSession({
    notes: 'x'.repeat(2000),
    completedExercises: [{ exerciseId: 'squat', name: 'Squat', exercise_type: 'WEIGHTED', sets: validSets(50) }]
  }));
  assert.equal(atTheLimit.status, 200, 'the limits are ceilings, not refusals of the boundary');
});

test('AC16 more than 50 entries in selected answers 400', async () => {
  const selected = Array.from({ length: 51 }, (_, index) => ({ exerciseId: `exercise-${index}` }));
  const refused = await postJson(shared.server, '/api/pairings', { selected });
  assert.equal(refused.status, 400);

  const accepted = await postJson(shared.server, '/api/pairings', { selected: selected.slice(0, 50) });
  assert.equal(accepted.status, 200, '50 chosen exercises are still answered');
});

test('AC17 a draft state over 64 KB or a store over 1 MB answers 413', async () => {
  const endpoint = '/api/workout-draft/limits-user';
  const small = await fetch(`${shared.server.baseUrl}${endpoint}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'sets', state: { marker: 'small' } })
  });
  assert.equal(small.status, 200);

  const bigState = await fetch(`${shared.server.baseUrl}${endpoint}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'sets', state: { blob: 'x'.repeat(70 * 1024) } })
  });
  assert.equal(bigState.status, 413, 'a state over 64 KB is refused as too large');

  // Another account's fresh draft already fills the shared store: one more save would pass 1 MB.
  const draftsFile = path.join(shared.root, 'workout-drafts.json');
  fs.writeFileSync(draftsFile, JSON.stringify({
    'other-user': {
      mode: 'sets', elapsed: 0, state: { blob: 'x'.repeat(1024 * 1024) }, savedAt: Date.now()
    }
  }));
  const overStore = await fetch(`${shared.server.baseUrl}${endpoint}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'sets', state: { marker: 'small' } })
  });
  assert.equal(overStore.status, 413, 'a store over 1 MB is refused as too large');
});

test('AC18 a declared type or a name outside the allowlist answers 400 and stores nothing', async () => {
  const before = uploadsHeld().length;
  const refusals = [
    { filename: 'evil.svg', contentType: 'image/png' },
    { filename: 'photo.png', contentType: 'text/html' },
    { filename: 'photo.png', contentType: 'image/svg+xml' },
    { filename: 'photo.txt', contentType: 'image/png' },
    { filename: 'noextension', contentType: 'image/png' }
  ];
  for (const attempt of refusals) {
    const res = await upload(shared.server, attempt);
    assert.equal(res.status, 400, `${attempt.filename} as ${attempt.contentType} is refused`);
  }
  assert.equal(uploadsHeld().length, before, 'nothing was written for a refused upload');
});

test('AC19 an accepted upload is stored under a generated name with an allowlisted extension', async () => {
  const res = await upload(shared.server, { filename: 'Shot.JPEG', contentType: 'image/jpeg' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.filename, /^image-\d+-\d+\.jpeg$/, 'the stored name is generated');
  assert.equal(body.imageUrl, `/uploads/${body.filename}`);
  createdFiles.push(body.filename);
  assert.equal(fs.existsSync(path.join(UPLOADS, body.filename)), true);
});

test('AC20 /uploads sends nosniff, and inline only for the allowed image types', async () => {
  const res = await upload(shared.server, { filename: 'photo.png', contentType: 'image/png' });
  assert.equal(res.status, 200);
  const { filename } = await res.json();
  createdFiles.push(filename);

  const image = await fetch(`${shared.server.baseUrl}/uploads/${filename}`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(image.headers.get('content-disposition'), 'inline');

  const stray = 'limits-probe.txt';
  fs.writeFileSync(path.join(UPLOADS, stray), 'not an image');
  try {
    const other = await fetch(`${shared.server.baseUrl}/uploads/${stray}`);
    assert.equal(other.status, 200);
    assert.equal(other.headers.get('x-content-type-options'), 'nosniff');
    assert.notEqual(other.headers.get('content-disposition'), 'inline', 'only image types render inline');
  } finally {
    fs.rmSync(path.join(UPLOADS, stray), { force: true });
  }
});

test('AC21 the 21st file and a request past 50 MB answer 413', async () => {
  const { parent, root } = pendingDataRoot();
  try {
    await withServer({ dataDir: root, cleanup: false }, async (server) => {
      for (let index = 0; index < 20; index += 1) {
        const res = await upload(server, { filename: `shot-${index}.png`, contentType: 'image/png' });
        assert.equal(res.status, 200, `upload ${index + 1} is under the quota`);
        createdFiles.push((await res.json()).filename);
      }
      const overCount = await upload(server, { filename: 'shot-20.png', contentType: 'image/png' });
      assert.equal(overCount.status, 413, 'a principal holds at most 20 files');
    });

    // The byte ceiling: one entry already worth 50 MB is enough to refuse the next request.
    const bytes = pendingDataRoot();
    try {
      await withServer({ dataDir: bytes.root, cleanup: false }, async (server) => {
        fs.writeFileSync(path.join(bytes.root, 'uploads.json'), JSON.stringify([
          { name: 'already-there.png', size: 50 * 1024 * 1024, owner: null, at: Date.now() }
        ]));
        const overBytes = await upload(server, { filename: 'shot.png', contentType: 'image/png' });
        assert.equal(overBytes.status, 413, 'a principal holds at most 50 MB');
      });
    } finally {
      fs.rmSync(bytes.parent, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
    removeCreatedUploads();
  }
});

test('AC23 a route that throws answers JSON 500 from the last error middleware', async () => {
  const malformed = await fetch(`${shared.server.baseUrl}/api/workout-session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"broken": '
  });
  assert.equal(malformed.status, 500);
  assert.match(malformed.headers.get('content-type') || '', /application\/json/);
  assert.ok((await malformed.json()).error, 'the body is the JSON error object');

  // A path the router cannot decode throws inside the stack the same way.
  const undecodable = await fetch(`${shared.server.baseUrl}/api/days/%E0%A4%A`);
  assert.equal(undecodable.status, 500);
  assert.match(undecodable.headers.get('content-type') || '', /application\/json/);
});

test('AC24 GET /api/unsplash-key answers 404 and leaks no environment value', async () => {
  const res = await fetch(`${shared.server.baseUrl}/api/unsplash-key`);
  assert.equal(res.status, 404);
  const text = await res.text();
  assert.equal(text.includes('unsplash-secret-value'), false, 'the key is not in the answer');
});

test('AC26 the webhook answers 503 while no secret is configured', async () => {
  const res = await fetch(`${shared.server.baseUrl}/telegram-webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'anything' },
    body: JSON.stringify({ update_id: 1 })
  });
  assert.equal(res.status, 503);
});

test('AC25 the webhook answers 401 for a missing or wrong secret token', async () => {
  const { parent, root } = pendingDataRoot();
  try {
    await withServer({ dataDir: root, env: { TELEGRAM_SECRET_TOKEN: 'hook-secret' } }, async (server) => {
      const missing = await fetch(`${server.baseUrl}/telegram-webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ update_id: 1 })
      });
      assert.equal(missing.status, 401);

      const wrong = await fetch(`${server.baseUrl}/telegram-webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'not-it' },
        body: JSON.stringify({ update_id: 2 })
      });
      assert.equal(wrong.status, 401);

      const right = await fetch(`${server.baseUrl}/telegram-webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'hook-secret' },
        body: JSON.stringify({ update_id: 3 })
      });
      assert.equal(right.status, 200, 'the configured secret is accepted');
    });
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('AC27 the webhook never writes the update body to the log', async () => {
  const mark = `LEAK-MARK-${Date.now()}`;
  const { parent, root } = pendingDataRoot();
  try {
    await withServer({ dataDir: root, env: { TELEGRAM_SECRET_TOKEN: 'hook-secret' } }, async (server) => {
      const res = await fetch(`${server.baseUrl}/telegram-webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'hook-secret' },
        body: JSON.stringify({ update_id: 987654, message: { text: mark } })
      });
      assert.equal(res.status, 200);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const log = server.logs();
      assert.equal(log.includes(mark), false, 'the update body is not logged');
      assert.ok(log.includes('987654'), 'the update id is what the log carries');
    });
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
