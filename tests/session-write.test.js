const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SESSIONS_FILE = path.join(ROOT, 'data', 'workout-sessions.json');
const TEST_USER_ID = 'test-session-write-user';

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

function startServer(port) {
  return spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

async function waitForHealth(baseUrl, child, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

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

test('a finished workout is written to the server', async (t) => {
  const originalSessions = fs.existsSync(SESSIONS_FILE)
    ? fs.readFileSync(SESSIONS_FILE, 'utf8')
    : null;

  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = startServer(port);

  t.after(async () => {
    await stopServer(child);
    // Leave data/workout-sessions.json exactly as it was before the test.
    if (originalSessions === null) {
      fs.rmSync(SESSIONS_FILE, { force: true });
    } else {
      fs.writeFileSync(SESSIONS_FILE, originalSessions);
    }
  });

  await waitForHealth(baseUrl, child);

  // The shape the WorkoutSession model produces once the component adds userId.
  const payload = {
    userId: TEST_USER_ID,
    date: new Date().toISOString(),
    total_duration: 1800,
    total_volume_kg: 1200,
    completedExercises: [
      {
        name: 'Bench Press',
        sets: [
          { reps: 5, weight: 60 },
          { reps: 5, weight: 60 }
        ]
      }
    ]
  };

  const res = await fetch(`${baseUrl}/api/workout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  assert.equal(res.status, 200);
  const answer = await res.json();
  const id = answer && answer.session ? answer.session.id : answer && answer.id;
  assert.ok(id !== undefined && id !== null && String(id) !== '', 'the answer carries an id');

  // The row really reached the store, not just the response.
  const stored = await (await fetch(`${baseUrl}/api/workout-sessions/${TEST_USER_ID}`)).json();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].id, id);
});
