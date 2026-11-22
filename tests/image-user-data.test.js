const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
const dockerignore = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8');

const REFERENCE_FILES = [
  'exercise-catalogue.json',
  'exercise-taxonomy.json',
  'equipment.json',
  'pillars.json',
  'weekly-targets.json'
];

const USER_DATA = [
  'workout-sessions.json',
  'user-profiles.json',
  'training-plans.json',
  'workout-drafts.json',
  '1.json',
  'default-user.json',
  'test-user.json'
];

function copySources() {
  return dockerfile
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^COPY\s/i.test(line))
    .map((line) => line.replace(/\s+/g, ' ').split(' ').slice(1))
    .map((args) => {
      const sources = args.filter((arg) => !arg.startsWith('--'));
      return sources.slice(0, -1);
    });
}

test('test_ac34_image_carries_no_user_data', () => {
  // No COPY may name the data directory itself: only explicit reference files may enter the image.
  for (const sources of copySources()) {
    for (const source of sources) {
      assert.notEqual(
        source.replace(/^\.\//, '').replace(/\/$/, ''),
        'data',
        `Dockerfile copies the whole data directory (${source})`
      );
    }
  }

  // The reference files the app reads at boot must still be copied explicitly.
  const allSources = copySources().flat();
  for (const name of REFERENCE_FILES) {
    assert.ok(
      allSources.includes(`data/${name}`),
      `Dockerfile does not copy reference file data/${name}`
    );
  }

  // Every live-data name is excluded from the build context.
  const ignored = dockerignore.split('\n').map((line) => line.trim());
  for (const name of USER_DATA) {
    assert.ok(
      ignored.includes(`data/${name}`),
      `.dockerignore does not exclude data/${name}`
    );
  }
});
