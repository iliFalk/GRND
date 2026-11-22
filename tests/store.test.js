const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { readJson, writeJson, updateJson } = require('../backend/utils/store');

function tempFile(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grnd-store-'));
  const file = path.join(dir, 'data.json');
  if (content !== undefined) fs.writeFileSync(file, content);
  return file;
}

test('test_a_missing_file_answers_the_fallback', async () => {
  const file = path.join(os.tmpdir(), 'grnd-store-missing', 'data.json');
  assert.deepEqual(await readJson(file, { sessions: [] }), { sessions: [] });
});

test('test_a_damaged_file_throws_instead_of_reading_as_empty', async () => {
  const file = tempFile('{"sessions": [');
  await assert.rejects(() => readJson(file, { sessions: [] }), /cannot be read/);
});

test('test_a_damaged_file_is_never_overwritten', async () => {
  const file = tempFile('{"sessions": [');
  await assert.rejects(
    () => updateJson(file, { sessions: [] }, (current) => ({ ...current, added: true })),
    /cannot be read/
  );

  assert.equal(fs.readFileSync(file, 'utf8'), '{"sessions": [');
});

test('test_twenty_changes_at_once_all_land', async () => {
  // Without a queue the read-change-write cycles overlap and all but the last disappear.
  const file = tempFile(JSON.stringify({ items: [] }));

  await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      updateJson(file, { items: [] }, (current) => ({ items: [...current.items, index] }))
    )
  );

  const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(stored.items.length, 20);
  assert.deepEqual([...stored.items].sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i));
});

test('AC30_a_write_leaves_mode_0600_on_the_file_and_no_leftover_temporary', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grnd-store-'));

  // A file that is already world-readable: the rename must bring the temp's mode, not keep the old one.
  const file = path.join(dir, 'data.json');
  fs.writeFileSync(file, JSON.stringify({ items: [] }));
  fs.chmodSync(file, 0o644);

  await writeJson(file, { items: [1] });

  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.deepEqual(
    fs.readdirSync(dir).filter((name) => name.endsWith('.tmp')),
    []
  );

  // A file the store creates itself is born 0600 instead of the umask's 0644.
  const fresh = path.join(dir, 'fresh.json');
  await writeJson(fresh, { items: [] });

  assert.equal(fs.statSync(fresh).mode & 0o777, 0o600);
  assert.deepEqual(
    fs.readdirSync(dir).filter((name) => name.endsWith('.tmp')),
    []
  );
});

test('test_a_write_leaves_no_temporary_file', async () => {
  const file = tempFile(JSON.stringify({ items: [] }));
  await writeJson(file, { items: [1, 2, 3] });

  const leftovers = fs.readdirSync(path.dirname(file)).filter((name) => name.endsWith('.tmp'));
  assert.deepEqual(leftovers, []);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { items: [1, 2, 3] });
});

test('test_a_failed_change_leaves_the_file_as_it_was', async () => {
  const file = tempFile(JSON.stringify({ items: [1] }));

  await assert.rejects(() =>
    updateJson(file, { items: [] }, () => {
      throw new Error('the change itself failed');
    })
  );

  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { items: [1] });
});
