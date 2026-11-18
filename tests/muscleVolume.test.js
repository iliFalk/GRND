const test = require('node:test');
const assert = require('node:assert/strict');
const MuscleVolume = require('../backend/utils/muscleVolume.js');

/** A session inside one fixed week, so the tests never depend on today's date. */
function session(date, exercises, userId = 'u1') {
  return { userId, date: new Date(date), completedExercises: exercises };
}

test('test_primary_counts_one_and_secondary_half', () => {
  // Bench Press: chest is primary, triceps and shoulders are secondary.
  const report = MuscleVolume.weeklyReport([
    session('2026-03-03T10:00:00', [{ name: 'Bench Press', completed_sets: [{ reps: 5 }, { reps: 5 }] }])
  ], { week: '2026-03-03' });
  const by = Object.fromEntries(report.groups.map((row) => [row.group, row.sets]));
  assert.equal(by.chest, 2);
  assert.equal(by.triceps, 1);
  assert.equal(by.shoulders, 1);
});

test('test_circuit_rounds_count_as_sets', () => {
  const report = MuscleVolume.weeklyReport([
    session('2026-03-04T10:00:00', [{ name: 'Kettlebell Swing', completed_rounds: [{ reps: 15 }, { reps: 15 }, { reps: 15 }] }])
  ], { week: '2026-03-04' });
  const by = Object.fromEntries(report.groups.map((row) => [row.group, row.sets]));
  assert.equal(by.glutes, 3);
  assert.equal(by.hamstrings, 3);
  assert.equal(by.back, 1.5);
  assert.equal(by.core, 1.5);
});

test('test_week_holds_monday_to_sunday_only', () => {
  const report = MuscleVolume.weeklyReport([
    session('2026-03-01T10:00:00', [{ name: 'Plank', completed_sets: [{ reps: 1 }] }]), // Sunday before
    session('2026-03-02T10:00:00', [{ name: 'Plank', completed_sets: [{ reps: 1 }] }]), // Monday
    session('2026-03-08T23:00:00', [{ name: 'Plank', completed_sets: [{ reps: 1 }] }]), // Sunday last
    session('2026-03-09T00:30:00', [{ name: 'Plank', completed_sets: [{ reps: 1 }] }])  // next Monday
  ], { week: '2026-03-04' });
  const core = report.groups.find((row) => row.group === 'core');
  assert.equal(core.sets, 2);
  assert.equal(report.sessions, 2);
});

test('test_unknown_exercise_is_unmapped_not_counted', () => {
  const report = MuscleVolume.weeklyReport([
    session('2026-03-03T10:00:00', [{ name: 'Moon Walk', completed_sets: [{ reps: 5 }] }])
  ], { week: '2026-03-03' });
  assert.deepEqual(report.unmapped, [{ name: 'Moon Walk', sets: 1 }]);
  assert.equal(report.groups.reduce((sum, row) => sum + row.sets, 0), 0);
});

test('test_keyword_fallback_places_a_new_variant', () => {
  const report = MuscleVolume.weeklyReport([
    session('2026-03-03T10:00:00', [{ name: 'Kettlebell Front Squat', completed_sets: [{ reps: 5 }, { reps: 5 }] }])
  ], { week: '2026-03-03' });
  const by = Object.fromEntries(report.groups.map((row) => [row.group, row.sets]));
  assert.equal(by.quads, 2);
  assert.equal(by.glutes, 2);
});

test('test_status_follows_the_band', () => {
  const target = { min: 10, target_low: 10, target_high: 20, max: 25 };
  assert.equal(MuscleVolume.statusFor(2, target), 'below');
  assert.equal(MuscleVolume.statusFor(12, target), 'in');
  assert.equal(MuscleVolume.statusFor(22, target), 'above');
  assert.equal(MuscleVolume.statusFor(30, target), 'high');
});

test('test_other_users_are_excluded', () => {
  const report = MuscleVolume.weeklyReport([
    session('2026-03-03T10:00:00', [{ name: 'Plank', completed_sets: [{ reps: 1 }] }], 'u1'),
    session('2026-03-03T10:00:00', [{ name: 'Plank', completed_sets: [{ reps: 1 }] }], 'u2')
  ], { week: '2026-03-03', userId: 'u1' });
  assert.equal(report.groups.find((row) => row.group === 'core').sets, 1);
});

test('test_a_week_is_monday_to_sunday', () => {
  const bounds = MuscleVolume.weekBounds('2026-03-05'); // a Thursday
  assert.equal(bounds.start.toISOString().slice(0, 10), '2026-03-02');
  assert.equal(bounds.end.toISOString().slice(0, 10), '2026-03-09');
});
