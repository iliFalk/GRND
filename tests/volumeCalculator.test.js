const test = require('node:test');
const assert = require('node:assert/strict');
const VolumeCalculator = require('../backend/utils/volumeCalculator.js');

test('test_weighted_sets', () => {
  const volume = VolumeCalculator.calculateExerciseVolume({
    exercise_type: 'WEIGHTED',
    completed_sets: [{ weight: 100, reps: 5 }, { weight: 80, reps: 10 }]
  }, 0);
  assert.equal(volume, 1300);
});

test('test_bodyweight_uses_the_table_factor', () => {
  const volume = VolumeCalculator.calculateExerciseVolume({
    exercise_type: 'BODYWEIGHT',
    exercise_name: 'Push-ups',
    completed_sets: [{ reps: 10 }, { reps: 10 }]
  }, 80);
  // Push-ups: 0.75 of the body, so 80 × 0.75 × 20
  assert.equal(volume, 1200);
});

test('test_an_explicit_factor_wins_over_the_table', () => {
  const volume = VolumeCalculator.calculateExerciseVolume({
    exercise_type: 'BODYWEIGHT',
    exercise_name: 'Push-ups',
    bodyweight_load_percentage: 0.5,
    completed_sets: [{ reps: 20 }]
  }, 80);
  assert.equal(volume, 800);
});

test('test_load_added_to_the_body_counts', () => {
  // A chin-up on rings at 80 kg with a 13 kg backpack: (80 × 1.0 + 13) × 6
  const volume = VolumeCalculator.calculateExerciseVolume({
    exercise_type: 'BODYWEIGHT',
    exercise_name: 'Pull-ups',
    completed_sets: [{ reps: 6, weight: 13 }]
  }, 80);
  assert.equal(volume, 558);
});

test('test_a_negative_added_load_is_ignored_not_subtracted', () => {
  const volume = VolumeCalculator.calculateExerciseVolume({
    exercise_type: 'BODYWEIGHT',
    exercise_name: 'Dips',
    completed_sets: [{ reps: 5, weight: -10 }]
  }, 80);
  // Dips: 0.8 × 80 × 5, the negative weight never reduces the body
  assert.equal(volume, 320);
});

test('test_no_work_is_zero', () => {
  assert.equal(VolumeCalculator.calculateExerciseVolume({ exercise_type: 'WEIGHTED', completed_sets: [] }, 0), 0);
  assert.equal(VolumeCalculator.calculateTotalVolume([], 80), 0);
});

test('test_a_bodyweight_volume_without_a_bodyweight_throws', () => {
  assert.throws(() => VolumeCalculator.calculateExerciseVolume({
    exercise_type: 'BODYWEIGHT',
    exercise_name: 'Dips',
    completed_sets: [{ reps: 5 }]
  }, undefined));
});
