const test = require('node:test');
const assert = require('node:assert/strict');

const { blockReport, blockFor, effortOf, config, EFFORT } = require('../backend/utils/period');

/**
 * The cases take their dates from the shipped anchor, because the anchor is a config the app owns: a
 * test that pins a date breaks the day he moves the grid.
 */
const SETTINGS = config();
const BODYWEIGHT = 86;
const DAY = 24 * 60 * 60 * 1000;

/** A moment `days` after the anchor, at `hour` UTC. */
function at(days, hour = 18) {
  const date = new Date(SETTINGS.anchor.getTime() + days * DAY);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

/** The last hours of the first block: every week of it is over, the block itself is not. */
const END_OF_FIRST_BLOCK = at(SETTINGS.blockDays - 1, 23);

function session(date, exercises, extra = {}) {
  return { userId: 'u1', date: new Date(date), completedExercises: exercises, ...extra };
}

function row(name, reps, weight, count) {
  return {
    name,
    completed_sets: Array.from({ length: count }, () => ({ reps, weight, completed: true }))
  };
}

test('test_the_anchor_fixes_the_block_and_the_week', () => {
  const settings = { anchor: new Date('2026-11-23T00:00:00Z'), blockDays: 28, blocksPerCycle: 4 };

  const first = blockFor(new Date('2026-11-23T12:00:00Z'), settings);
  assert.equal(first.block, 0);
  assert.equal(first.week, 1);

  const lastWeek = blockFor(new Date('2026-12-20T12:00:00Z'), settings);
  assert.equal(lastWeek.block, 0);
  assert.equal(lastWeek.week, 4);

  const next = blockFor(new Date('2026-12-21T12:00:00Z'), settings);
  assert.equal(next.block, 1);
  assert.equal(next.week, 1);

  // The shipped anchor starts on a Monday: the weeks of the grid are whole weeks.
  assert.equal(SETTINGS.anchor.getUTCDay(), 1);
});

test('test_a_week_is_compared_with_the_week_before_it', () => {
  const report = blockReport(
    [
      session(at(1), [row('One-arm kettlebell row', 10, 24, 3)]),
      session(at(8), [row('One-arm kettlebell row', 10, 24, 4)])
    ],
    { userId: 'u1', bodyweight: BODYWEIGHT, now: END_OF_FIRST_BLOCK }
  );

  assert.equal(report.block, 0);
  assert.equal(report.weeks.length, 4);
  assert.equal(report.weeks[0].change, null);
  // Four sets against three: a third more work.
  assert.equal(report.weeks[1].change, 33.3);
});

test('test_a_week_still_running_shows_no_change', () => {
  const report = blockReport(
    [
      session(at(1), [row('One-arm kettlebell row', 10, 24, 3)]),
      session(at(8), [row('One-arm kettlebell row', 10, 24, 3)]),
      session(at(15), [row('One-arm kettlebell row', 10, 24, 1)])
    ],
    // The third week has only begun: its number would read as a fall.
    { userId: 'u1', bodyweight: BODYWEIGHT, now: at(15, 20) }
  );

  assert.equal(report.weeks[2].closed, false);
  assert.equal(report.weeks[2].change, null);
});

test('test_the_effort_tap_scales_the_work_and_defaults_to_full', () => {
  const sets = [row('One-arm kettlebell row', 10, 20, 1)];
  const options = { userId: 'u1', bodyweight: BODYWEIGHT, now: END_OF_FIRST_BLOCK };
  const full = blockReport([session(at(1), sets)], options);
  const near = blockReport([session(at(1), sets, { effort: 'near' })], options);

  assert.equal(full.work, 200);
  assert.equal(near.work, 180);
  assert.equal(effortOf({}).factor, 1);
  assert.equal(EFFORT.easy.percent, 70);
});

test('test_the_body_carries_its_share_of_a_bodyweight_set', () => {
  const report = blockReport([session(at(1), [row('Dips', 10, 0, 1)])], {
    userId: 'u1',
    bodyweight: BODYWEIGHT,
    now: END_OF_FIRST_BLOCK
  });

  // 86 kg × the catalogue's factor of 0.8 × 10 reps.
  assert.equal(report.work, 688);
});

test('test_a_warmup_set_and_a_circuit_are_not_work', () => {
  const warm = {
    name: 'Dips',
    completed_sets: [
      { reps: 10, weight: 0, warmup: true },
      { reps: 10, weight: 0 }
    ]
  };
  const report = blockReport(
    [session(at(1), [warm]), session(at(2), [row('Burpees', 20, 0, 3)], { dayType: 'CIRCUIT' })],
    { userId: 'u1', bodyweight: BODYWEIGHT, now: END_OF_FIRST_BLOCK }
  );

  assert.equal(report.sets, 1);
  assert.equal(report.work, 688);
});

test('test_a_closed_block_is_the_base_and_the_index_is_measured_against_it', () => {
  const sessions = [];
  // The block before: four sessions of 3×10 at 20 kg, one per week.
  for (const day of [-27, -20, -13, -6]) {
    sessions.push(session(at(day), [row('One-arm kettlebell row', 10, 20, 3)]));
  }
  // The current block: two sessions in its first week, at a heavier load.
  sessions.push(session(at(1), [row('One-arm kettlebell row', 10, 24, 3)]));
  sessions.push(session(at(2), [row('One-arm kettlebell row', 10, 24, 3)]));

  const report = blockReport(sessions, { userId: 'u1', bodyweight: BODYWEIGHT, now: at(3, 12) });

  assert.equal(report.block, 0);
  assert.equal(report.base.block, -1);
  assert.equal(report.base.work, 2400);
  assert.ok(report.work_index > 100, `index was ${report.work_index}`);
  assert.ok(report.peak_index > 100, `peak was ${report.peak_index}`);
});

test('test_a_falling_peak_outranks_a_rising_volume', () => {
  const base = [
    session(at(-27), [row('One-arm kettlebell row', 8, 32, 1)]),
    session(at(-26), [row('One-arm kettlebell row', 8, 32, 1)])
  ];
  // Twice the sets, lighter: more work, a weaker best set.
  const now = [session(at(1), [row('One-arm kettlebell row', 8, 28, 4)])];

  const report = blockReport([...base, ...now], {
    userId: 'u1',
    bodyweight: BODYWEIGHT,
    now: at(3, 12)
  });

  assert.equal(report.verdict, 'down');
});

test('test_an_empty_journal_says_open_not_zero', () => {
  const report = blockReport([], { userId: 'u1', bodyweight: BODYWEIGHT, now: END_OF_FIRST_BLOCK });

  assert.equal(report.work, 0);
  assert.equal(report.work_index, null);
  assert.equal(report.verdict, 'open');
  assert.equal(report.base, null);
});
