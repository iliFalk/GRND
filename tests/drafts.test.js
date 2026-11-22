const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { getDraft, putDraft, removeDraft, MAX_AGE_MS } = require('../backend/utils/drafts');

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grnd-drafts-'));
  return path.join(dir, 'workout-drafts.json');
}

const draft = (marker) => ({ mode: 'sets', elapsed: 60, state: { marker } });

test('test_a_draft_comes_back_for_the_user_who_wrote_it', async () => {
  const file = tempFile();
  await putDraft(file, 'u1', draft('a'), 1_700_000_000_000);

  const back = await getDraft(file, 'u1', 1_700_000_001_000);
  assert.equal(back.state.marker, 'a');
  assert.equal(back.mode, 'sets');
  assert.equal(back.savedAt, 1_700_000_000_000);
});

test('test_another_user_reads_nothing', async () => {
  const file = tempFile();
  await putDraft(file, 'u1', draft('a'), 1_700_000_000_000);
  assert.equal(await getDraft(file, 'u2', 1_700_000_001_000), null);
});

test('test_a_second_save_replaces_the_first', async () => {
  const file = tempFile();
  await putDraft(file, 'u1', draft('a'), 1_700_000_000_000);
  await putDraft(file, 'u1', draft('b'), 1_700_000_002_000);

  const back = await getDraft(file, 'u1', 1_700_000_003_000);
  assert.equal(back.state.marker, 'b');
});

test('test_a_draft_from_yesterday_is_not_answered', async () => {
  const file = tempFile();
  await putDraft(file, 'u1', draft('a'), 1_700_000_000_000);

  assert.equal(await getDraft(file, 'u1', 1_700_000_000_000 + MAX_AGE_MS + 1_000), null);
});

test('test_writing_drops_the_drafts_nobody_came_back_to', async () => {
  const file = tempFile();
  await putDraft(file, 'old', draft('old'), 1_700_000_000_000);
  await putDraft(file, 'new', draft('new'), 1_700_000_000_000 + MAX_AGE_MS + 1_000);

  const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(Object.keys(stored), ['new']);
});

test('test_a_finished_workout_leaves_no_draft', async () => {
  const file = tempFile();
  await putDraft(file, 'u1', draft('a'), 1_700_000_000_000);

  assert.equal(await removeDraft(file, 'u1'), true);
  assert.equal(await getDraft(file, 'u1', 1_700_000_001_000), null);
});

test('test_a_missing_file_answers_nothing_instead_of_throwing', async () => {
  assert.equal(await getDraft('/tmp/grnd-nonexistent-drafts.json', 'u1'), null);
});

test('test_five_drafts_saved_at_once_all_land', async () => {
  // Without the queue four of five saves were lost and three callers got a 500.
  const file = tempFile();
  const now = 1_700_000_000_000;

  const answers = await Promise.allSettled(
    ['a', 'b', 'c', 'd', 'e'].map((user) => putDraft(file, user, draft(user), now))
  );

  assert.deepEqual(answers.map((answer) => answer.status), [
    'fulfilled',
    'fulfilled',
    'fulfilled',
    'fulfilled',
    'fulfilled'
  ]);
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(file, 'utf8'))).sort(), ['a', 'b', 'c', 'd', 'e']);
});

test('test_a_damaged_draft_file_is_moved_aside_not_overwritten', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grnd-drafts-'));
  const file = path.join(dir, 'workout-drafts.json');
  fs.writeFileSync(file, '{"u1":{"mode":"sets"');

  await putDraft(file, 'u2', draft('b'), 1_700_000_000_000);

  const aside = fs.readdirSync(dir).filter((name) => name.includes('.corrupt-'));
  assert.equal(aside.length, 1);
  assert.equal(fs.readFileSync(path.join(dir, aside[0]), 'utf8'), '{"u1":{"mode":"sets"');
  assert.equal((await getDraft(file, 'u2', 1_700_000_001_000)).state.marker, 'b');
});
