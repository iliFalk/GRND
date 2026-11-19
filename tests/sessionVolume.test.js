const test = require('node:test');
const assert = require('node:assert/strict');

const { computeSessionVolume, exerciseType } = require('../backend/utils/sessionVolume');

const bodyweight = 70;

test('test_weighted_volume_comes_from_the_sets_done', () => {
  const done = computeSessionVolume(
    [{ exerciseId: 'kettlebell-swing', name: 'Kettlebell Swing', sets: [{ reps: 15, weight: 16 }, { reps: 15, weight: 16 }] }],
    bodyweight
  );

  assert.equal(done.totalVolume, 480);
  assert.equal(done.totalSets, 2);
  assert.equal(done.exercises[0].volume, 480);
  assert.equal(done.exercises[0].exerciseType, 'WEIGHTED');
});

test('test_bodyweight_work_counts_the_body_it_moves', () => {
  const done = computeSessionVolume(
    [{ exerciseId: 'push-ups', name: 'Push-ups', sets: [{ reps: 12 }, { reps: 12 }] }],
    bodyweight
  );

  // 70 kg × 0.75 × 24 reps
  assert.equal(done.totalVolume, 1260);
  assert.equal(done.exercises[0].exerciseType, 'BODYWEIGHT');
});

test('test_a_load_added_to_the_body_counts_with_it', () => {
  const done = computeSessionVolume(
    [{ exerciseId: 'push-ups', name: 'Push-ups', sets: [{ reps: 10, weight: 13 }] }],
    bodyweight
  );

  // (70 × 0.75 + 13) × 10
  assert.equal(done.totalVolume, 655);
});

test('test_a_bodyweight_exercise_without_a_bodyweight_is_refused', () => {
  assert.throws(
    () => computeSessionVolume([{ exerciseId: 'push-ups', name: 'Push-ups', sets: [{ reps: 10 }] }], undefined),
    /bodyweight/
  );
});

test('test_the_type_comes_from_the_catalogue', () => {
  assert.equal(exerciseType({ exerciseId: 'dips', name: 'Dips' }), 'BODYWEIGHT');
  assert.equal(exerciseType({ exerciseId: 'air-squats', name: 'Air squats' }), 'WEIGHTED');
});

test('test_an_explicit_type_wins_over_the_catalogue', () => {
  const done = computeSessionVolume(
    [{ exerciseId: 'push-ups', name: 'Push-ups', exerciseType: 'WEIGHTED', sets: [{ reps: 10 }] }],
    bodyweight
  );

  assert.equal(done.exercises[0].exerciseType, 'WEIGHTED');
  assert.equal(done.totalVolume, 0);
});

test('test_a_set_without_a_weight_adds_no_volume_to_a_weighted_exercise', () => {
  const done = computeSessionVolume(
    [{ exerciseId: 'air-squats', name: 'Air squats', sets: [{ reps: 10 }, { reps: 10 }, { reps: 10 }] }],
    bodyweight
  );

  assert.equal(done.totalVolume, 0);
  assert.equal(done.totalSets, 3);
});

test('test_an_empty_session_is_zero_and_counts_nothing', () => {
  const done = computeSessionVolume([], bodyweight);
  assert.equal(done.totalVolume, 0);
  assert.equal(done.totalSets, 0);
  assert.deepEqual(done.exercises, []);
});

test('test_the_completed_sets_name_is_read_after_the_sets_name', () => {
  const done = computeSessionVolume(
    [{ exerciseId: 'kettlebell-swing', name: 'Kettlebell Swing', completed_sets: [{ reps: 10, weight: 10 }] }],
    bodyweight
  );

  assert.equal(done.totalVolume, 100);
  assert.equal(done.totalSets, 1);
});
