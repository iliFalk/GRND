const test = require('node:test');
const assert = require('node:assert/strict');

const { weeklyPillars } = require('../backend/utils/pillars');

function session(date, exercises, extra = {}) {
  return { userId: 'u1', date: new Date(date), completedExercises: exercises, ...extra };
}

function byPillar(report) {
  return Object.fromEntries(report.pillars.map((row) => [row.id, row.sets]));
}

test('test_a_set_counts_once_for_its_pillar', () => {
  // Push-ups are push; nothing is credited to chest or triceps.
  const report = weeklyPillars(
    [session('2026-03-03T10:00:00', [{ name: 'Push-ups', completed_sets: [{ reps: 10 }, { reps: 10 }, { reps: 10 }] }])],
    { week: '2026-03-03' }
  );

  assert.equal(byPillar(report).push, 3);
  assert.equal(byPillar(report).pull, 0);
  assert.equal(byPillar(report).legs, 0);
  assert.equal(report.pillars.find((row) => row.id === 'push').status, 'below');
});

test('test_legs_take_squat_hinge_and_power', () => {
  const report = weeklyPillars(
    [
      session('2026-03-03T10:00:00', [
        { name: 'Air squats', completed_sets: [{ reps: 10 }, { reps: 10 }] },
        { name: 'Kettlebell Swing', completed_sets: [{ reps: 15 }] },
        { name: 'Jump onto chair', completed_sets: [{ reps: 5 }, { reps: 5 }] }
      ])
    ],
    { week: '2026-03-03' }
  );

  assert.equal(byPillar(report).legs, 5);
});

test('test_core_work_counts_as_pull', () => {
  const report = weeklyPillars(
    [session('2026-03-03T10:00:00', [{ name: 'Hanging knee raises', completed_sets: [{ reps: 10 }, { reps: 10 }] }])],
    { week: '2026-03-03' }
  );

  assert.equal(byPillar(report).pull, 2);
});

test('test_conditioning_stays_outside_the_pillars', () => {
  const report = weeklyPillars(
    [session('2026-03-03T10:00:00', [{ name: 'Burpees', completed_sets: [{ reps: 10 }, { reps: 10 }] }])],
    { week: '2026-03-03' }
  );

  assert.deepEqual(byPillar(report), { pull: 0, push: 0, legs: 0 });
  assert.deepEqual(report.outside, [{ name: 'Burpees', sets: 2 }]);
  assert.equal(report.sessions, 0);
});

test('test_a_circuit_session_stays_out_of_the_pillars', () => {
  const report = weeklyPillars(
    [
      session(
        '2026-03-03T10:00:00',
        [{ name: 'Push-ups', completed_sets: [{ reps: 10 }, { reps: 10 }] }],
        { dayType: 'CIRCUIT' }
      )
    ],
    { week: '2026-03-03' }
  );

  assert.equal(byPillar(report).push, 0);
});

test('test_a_warmup_set_is_not_counted', () => {
  const report = weeklyPillars(
    [
      session('2026-03-03T10:00:00', [
        { name: 'Pull-ups', completed_sets: [{ reps: 3, warmup: true }, { reps: 5 }, { reps: 5 }] }
      ])
    ],
    { week: '2026-03-03' }
  );

  assert.equal(byPillar(report).pull, 2);
});

test('test_short_is_the_gap_to_the_low_end', () => {
  const report = weeklyPillars(
    [session('2026-03-03T10:00:00', [{ name: 'Pull-ups', completed_sets: [{ reps: 5 }, { reps: 5 }] }])],
    { week: '2026-03-03' }
  );
  const pull = report.pillars.find((row) => row.id === 'pull');

  assert.equal(pull.sets, 2);
  assert.equal(pull.short, 8);
});

test('test_the_legs_band_starts_higher_than_the_upper_band', () => {
  const report = weeklyPillars([], { week: '2026-03-03' });
  const bands = Object.fromEntries(report.pillars.map((row) => [row.id, row.target.min]));

  assert.equal(bands.pull, 10);
  assert.equal(bands.push, 10);
  assert.equal(bands.legs, 12);
});

test('test_status_follows_the_band', () => {
  const state = (sets) =>
    weeklyPillars(
      [session('2026-03-03T10:00:00', [{ name: 'Push-ups', completed_sets: Array.from({ length: sets }, () => ({ reps: 10 })) }])],
      { week: '2026-03-03' }
    ).pillars.find((row) => row.id === 'push').status;

  assert.equal(state(4), 'below');
  assert.equal(state(14), 'in');
  assert.equal(state(23), 'above');
  assert.equal(state(30), 'high');
});

test('test_another_users_sessions_are_excluded', () => {
  const report = weeklyPillars(
    [
      session('2026-03-03T10:00:00', [{ name: 'Push-ups', completed_sets: [{ reps: 10 }] }], { userId: 'u1' }),
      session('2026-03-03T10:00:00', [{ name: 'Push-ups', completed_sets: [{ reps: 10 }] }], { userId: 'u2' })
    ],
    { week: '2026-03-03', userId: 'u1' }
  );

  assert.equal(byPillar(report).push, 1);
});

test('test_an_exercise_outside_the_catalogue_is_unmapped', () => {
  const report = weeklyPillars(
    [session('2026-03-03T10:00:00', [{ name: 'Bench Press', completed_sets: [{ reps: 5, weight: 80 }] }])],
    { week: '2026-03-03' }
  );

  assert.deepEqual(report.unmapped, [{ name: 'Bench Press', sets: 1 }]);
  assert.deepEqual(byPillar(report), { pull: 0, push: 0, legs: 0 });
});
