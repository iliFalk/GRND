const test = require('node:test');
const assert = require('node:assert/strict');

const { statsFor, periodDays } = require('../backend/utils/stats');

const NOW = '2026-03-31T12:00:00';

function session(date, exercises, extra = {}) {
  return { userId: 'u1', date: new Date(date), completedExercises: exercises, ...extra };
}

test('test_sets_and_reps_add_up_over_the_window', () => {
  const report = statsFor(
    [
      session('2026-03-29T10:00:00', [
        { name: 'Dips', completed_sets: [{ reps: 8, weight: 0 }, { reps: 8, weight: 0 }] },
        { name: 'One-arm kettlebell row', completed_sets: [{ reps: 10, weight: 20 }] }
      ]),
      session('2026-03-25T10:00:00', [
        { name: 'One-arm kettlebell row', completed_sets: [{ reps: 8, weight: 24 }, { reps: 6, weight: 24 }] }
      ]),
      // Older than the week that ends now: it is another window's business.
      session('2026-03-01T10:00:00', [{ name: 'Dips', completed_sets: [{ reps: 5, weight: 10 }] }])
    ],
    { period: 'week', now: NOW }
  );

  assert.equal(report.sessions, 2);
  assert.equal(report.sets, 5);
  assert.equal(report.reps, 40);
  assert.equal(report.exercises.length, 2);
});

test('test_the_heaviest_set_and_the_last_set_are_two_numbers', () => {
  const report = statsFor(
    [
      session('2026-03-20T10:00:00', [
        { name: 'One-arm kettlebell row', completed_sets: [{ reps: 5, weight: 32 }, { reps: 8, weight: 24 }] }
      ]),
      session('2026-03-27T10:00:00', [
        { name: 'One-arm kettlebell row', completed_sets: [{ reps: 8, weight: 28 }, { reps: 8, weight: 20 }] }
      ])
    ],
    { period: 'month', now: NOW }
  );

  const row = report.exercises.find((entry) => entry.name === 'One-arm kettlebell row');
  assert.equal(row.top_weight, 32);
  // The latest session decides the working weight, and its final set says what it was.
  assert.equal(row.last_weight, 20);
  assert.equal(row.bodyweight, false);
});

test('test_a_bodyweight_exercise_carries_its_own_mark', () => {
  const report = statsFor(
    [session('2026-03-30T10:00:00', [{ name: 'Chin-ups (rings)', completed_sets: [{ reps: 5, weight: 0 }] }])],
    { period: 'week', now: NOW }
  );

  const row = report.exercises.find((entry) => entry.name === 'Chin-ups (rings)');
  assert.equal(row.bodyweight, true);
  assert.equal(row.top_weight, null);
});

test('test_a_circuit_is_no_set_of_this_report', () => {
  const report = statsFor(
    [
      session('2026-03-30T10:00:00', [{ name: 'Burpees', completed_sets: [{ reps: 20 }] }], { dayType: 'CIRCUIT' }),
      session('2026-03-30T18:00:00', [{ name: 'Dips', completed_sets: [{ reps: 8 }] }])
    ],
    { period: 'week', now: NOW }
  );

  assert.equal(report.sets, 1);
  assert.equal(report.sessions, 1);
  assert.deepEqual(report.exercises.map((row) => row.name), ['Dips']);
});

test('test_a_warmup_set_is_not_work', () => {
  const report = statsFor(
    [
      session('2026-03-30T10:00:00', [
        { name: 'Dips', completed_sets: [{ reps: 10, weight: 0, warmup: true }, { reps: 8, weight: 10 }] }
      ])
    ],
    { period: 'week', now: NOW }
  );

  assert.equal(report.sets, 1);
  assert.equal(report.reps, 8);
});

test('test_another_account_is_another_journal', () => {
  const report = statsFor(
    [
      session('2026-03-30T10:00:00', [{ name: 'Dips', completed_sets: [{ reps: 8 }] }]),
      { ...session('2026-03-30T10:00:00', [{ name: 'Dips', completed_sets: [{ reps: 8 }] }]), userId: 'u2' }
    ],
    { period: 'week', userId: 'u2', now: NOW }
  );

  assert.equal(report.sessions, 1);
  assert.equal(report.sets, 1);
});

test('test_a_period_the_app_does_not_offer_answers_nothing', () => {
  assert.equal(statsFor([], { period: 'fortnight', now: NOW }), null);
  assert.equal(periodDays('year'), null);
  assert.equal(periodDays('y'), 365);
});
