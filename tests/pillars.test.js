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
        { name: 'Double kettlebell goblet squat', completed_sets: [{ reps: 8 }, { reps: 8 }] },
        { name: 'Kettlebell Swing', completed_sets: [{ reps: 15 }] },
        { name: 'Jump onto chair', completed_sets: [{ reps: 5 }, { reps: 5 }] }
      ])
    ],
    { week: '2026-03-03' }
  );

  assert.equal(byPillar(report).legs, 5);
});

test('test_a_snatch_counts_once_in_push', () => {
  // A pull that ends in a lockout: it counts in Push and nowhere else, and it is power work.
  const report = weeklyPillars(
    [session('2026-03-03T10:00:00', [{ name: 'Kettlebell Snatch', completed_sets: [{ reps: 5 }, { reps: 5 }] }])],
    { week: '2026-03-03' }
  );
  const push = report.pillars.find((row) => row.id === 'push');

  assert.equal(push.sets, 2);
  assert.equal(push.power_sets, 2);
  assert.equal(push.base_sets, 0);
  assert.equal(byPillar(report).pull, 0);
});

test('test_the_week_by_day_counts_each_day', () => {
  const report = weeklyPillars(
    [
      session('2026-03-03T10:00:00', [{ name: 'Push-ups', completed_sets: [{ reps: 10 }, { reps: 10 }] }]),
      session('2026-03-05T10:00:00', [{ name: 'Pull-ups', completed_sets: [{ reps: 5 }] }])
    ],
    { week: '2026-03-03' }
  );

  assert.equal(report.days.length, 7);
  const byDate = Object.fromEntries(report.days.map((day) => [day.date, day.sets]));

  assert.equal(byDate['2026-03-02'], 0);
  assert.equal(byDate['2026-03-03'], 2);
  assert.equal(byDate['2026-03-05'], 1);
  assert.deepEqual(report.days.find((day) => day.date === '2026-03-03').pillars, { push: 2 });
});

test('test_core_is_its_own_pillar', () => {
  // Ilja, 2026-11-19: the core is separate and it matters.
  const report = weeklyPillars(
    [session('2026-03-03T10:00:00', [{ name: 'Hanging knee raises', completed_sets: [{ reps: 10 }, { reps: 10 }] }])],
    { week: '2026-03-03' }
  );

  assert.equal(byPillar(report).core, 2);
  assert.equal(byPillar(report).pull, 0);
});

test('test_the_base_is_counted_inside_its_pillar', () => {
  // A goblet squat is base work; a jump is what completes it.
  const report = weeklyPillars(
    [
      session('2026-03-03T10:00:00', [
        { name: 'Double kettlebell goblet squat', completed_sets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }] },
        { name: 'Jump onto chair', completed_sets: [{ reps: 5 }] }
      ])
    ],
    { week: '2026-03-03' }
  );
  const legs = report.pillars.find((row) => row.id === 'legs');

  assert.equal(legs.sets, 4);
  assert.equal(legs.base_sets, 3);
  assert.equal(legs.power_sets, 1);
});

test('test_a_support_exercise_is_not_base', () => {
  const report = weeklyPillars(
    [session('2026-03-03T10:00:00', [{ name: 'Push-ups', completed_sets: [{ reps: 10 }, { reps: 10 }] }])],
    { week: '2026-03-03' }
  );
  const push = report.pillars.find((row) => row.id === 'push');

  assert.equal(push.sets, 2);
  assert.equal(push.base_sets, 0);
  assert.equal(push.exercises[0].role, 'support');
});

test('test_a_fly_is_kept_for_the_circuit_and_not_counted', () => {
  const report = weeklyPillars(
    [session('2026-03-03T10:00:00', [{ name: 'Dumbbell flyes', completed_sets: [{ reps: 12 }] }])],
    { week: '2026-03-03' }
  );

  assert.equal(byPillar(report).push, 0);
  assert.deepEqual(report.outside, [{ name: 'Dumbbell flyes', sets: 1 }]);
});

test('test_conditioning_stays_outside_the_pillars', () => {
  const report = weeklyPillars(
    [session('2026-03-03T10:00:00', [{ name: 'Burpees', completed_sets: [{ reps: 10 }, { reps: 10 }] }])],
    { week: '2026-03-03' }
  );

  assert.deepEqual(byPillar(report), { pull: 0, push: 0, legs: 0, core: 0 });
  assert.deepEqual(report.outside, [{ name: 'Burpees', sets: 2 }]);
  assert.equal(report.sessions, 0);
});

test('test_an_excluded_exercise_is_not_counted_in_its_pillar', () => {
  // Air squats stay in the catalogue and in the list, but Ilja does not count them as legs.
  const report = weeklyPillars(
    [session('2026-03-03T10:00:00', [{ name: 'Air squats', completed_sets: [{ reps: 15 }, { reps: 15 }] }])],
    { week: '2026-03-03' }
  );

  assert.equal(byPillar(report).legs, 0);
  assert.deepEqual(report.outside, [{ name: 'Air squats', sets: 2 }]);
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
  assert.equal(pull.short, 2);
});

test('test_every_pillar_needs_four_sets', () => {
  // Ilja, 2026-11-19: four sets is the floor of a pillar, and no upper bound is judged.
  const report = weeklyPillars([], { week: '2026-03-03' });
  const bands = Object.fromEntries(report.pillars.map((row) => [row.id, row.target.min]));

  assert.deepEqual(bands, { pull: 4, push: 4, legs: 4, core: 4 });
  assert.equal(report.pillars[0].target.max, null);
});

test('test_status_follows_the_band', () => {
  const state = (sets) =>
    weeklyPillars(
      [session('2026-03-03T10:00:00', [{ name: 'Push-ups', completed_sets: Array.from({ length: sets }, () => ({ reps: 10 })) }])],
      { week: '2026-03-03' }
    ).pillars.find((row) => row.id === 'push').status;

  assert.equal(state(3), 'below');
  assert.equal(state(4), 'in');
  assert.equal(state(14), 'in');
  assert.equal(state(30), 'in');
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
  assert.deepEqual(byPillar(report), { pull: 0, push: 0, legs: 0, core: 0 });
});
