const test = require('node:test');
const assert = require('node:assert/strict');

const { blockReport, blockFor, effortOf, config, EFFORT } = require('../backend/utils/period');

const NOW = '2026-12-20T12:00:00'; // block 0 runs 23 Nov – 20 Dec, so this is its last day
const BODYWEIGHT = 86;

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
  const settings = config();
  assert.equal(settings.anchor.toISOString().slice(0, 10), '2026-11-23');

  const first = blockFor('2026-11-23', settings);
  assert.equal(first.block, 0);
  assert.equal(first.week, 1);

  const lastWeek = blockFor('2026-12-20', settings);
  assert.equal(lastWeek.block, 0);
  assert.equal(lastWeek.week, 4);

  const next = blockFor('2026-12-21', settings);
  assert.equal(next.block, 1);
  assert.equal(next.week, 1);
});

test('test_a_week_is_compared_with_the_week_before_it', () => {
  const report = blockReport(
    [
      session('2026-11-24T18:00:00', [row('One-arm kettlebell row', 10, 24, 3)]),
      session('2026-12-01T18:00:00', [row('One-arm kettlebell row', 10, 24, 4)])
    ],
    { userId: 'u1', bodyweight: BODYWEIGHT, now: NOW }
  );

  assert.equal(report.block, 0);
  assert.equal(report.weeks.length, 4);
  assert.equal(report.weeks[0].change, null);
  // Four sets against three: a third more work.
  assert.equal(report.weeks[1].change, 33.3);
});

test('test_the_effort_tap_scales_the_work_and_defaults_to_full', () => {
  const sets = [row('One-arm kettlebell row', 10, 20, 1)];
  const full = blockReport([session('2026-11-24T18:00:00', sets)], {
    userId: 'u1',
    bodyweight: BODYWEIGHT,
    now: NOW
  });
  const near = blockReport([session('2026-11-24T18:00:00', sets, { effort: 'near' })], {
    userId: 'u1',
    bodyweight: BODYWEIGHT,
    now: NOW
  });

  assert.equal(full.work, 200);
  assert.equal(near.work, 180);
  assert.equal(effortOf({}).factor, 1);
  assert.equal(EFFORT.easy.percent, 70);
});

test('test_the_body_carries_its_share_of_a_bodyweight_set', () => {
  const report = blockReport([session('2026-11-24T18:00:00', [row('Dips', 10, 0, 1)])], {
    userId: 'u1',
    bodyweight: BODYWEIGHT,
    now: NOW
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
    [
      session('2026-11-24T18:00:00', [warm]),
      session('2026-11-25T18:00:00', [row('Burpees', 20, 0, 3)], { dayType: 'CIRCUIT' })
    ],
    { userId: 'u1', bodyweight: BODYWEIGHT, now: NOW }
  );

  assert.equal(report.sets, 1);
  assert.equal(report.work, 688);
});

test('test_a_closed_block_is_the_base_and_the_index_is_measured_against_it', () => {
  const sessions = [
    // Block 0: four weeks, one session each, growing.
    session('2026-11-24T18:00:00', [row('One-arm kettlebell row', 10, 20, 3)]),
    session('2026-12-01T18:00:00', [row('One-arm kettlebell row', 10, 20, 3)]),
    session('2026-12-08T18:00:00', [row('One-arm kettlebell row', 10, 20, 3)]),
    session('2026-12-15T18:00:00', [row('One-arm kettlebell row', 10, 20, 3)]),
    // Block 1, current: two sessions in its first week at a heavier load.
    session('2026-12-21T18:00:00', [row('One-arm kettlebell row', 10, 24, 3)]),
    session('2026-12-23T18:00:00', [row('One-arm kettlebell row', 10, 24, 3)])
  ];

  const report = blockReport(sessions, { userId: 'u1', bodyweight: BODYWEIGHT, now: '2026-12-24T12:00:00' });

  assert.equal(report.block, 1);
  assert.equal(report.base.block, 0);
  assert.equal(report.base.work, 2400);
  assert.ok(report.work_index > 100, `index was ${report.work_index}`);
  assert.ok(report.peak_index > 100, `peak was ${report.peak_index}`);
});

test('test_a_falling_peak_outranks_a_rising_volume', () => {
  const base = [
    session('2026-11-24T18:00:00', [row('One-arm kettlebell row', 8, 32, 1)]),
    session('2026-11-25T18:00:00', [row('One-arm kettlebell row', 8, 32, 1)])
  ];
  const now = [
    // Twice the sets, lighter: more work, a weaker best set.
    session('2026-12-21T18:00:00', [row('One-arm kettlebell row', 8, 28, 4)])
  ];

  const report = blockReport([...base, ...now], {
    userId: 'u1',
    bodyweight: BODYWEIGHT,
    now: '2026-12-22T12:00:00'
  });

  assert.equal(report.verdict, 'down');
});

test('test_an_empty_journal_says_open_not_zero', () => {
  const report = blockReport([], { userId: 'u1', bodyweight: BODYWEIGHT, now: NOW });

  assert.equal(report.work, 0);
  assert.equal(report.work_index, null);
  assert.equal(report.verdict, 'open');
  assert.equal(report.base, null);
});
