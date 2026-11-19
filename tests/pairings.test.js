const test = require('node:test');
const assert = require('node:assert/strict');
const { suggestPairs, suggestCircuit, alternativesForMissingEquipment } = require('../backend/utils/pairings.js');

const catalogue = {
  exercises: [
    { id: 'push-ups', name: 'Push-ups', equipment: 'bodyweight', movement: 'push', primary: ['chest'], secondary: ['triceps'] },
    { id: 'dips', name: 'Dips', equipment: 'bodyweight', movement: 'push', primary: ['triceps', 'chest'], secondary: [] },
    { id: 'one-arm-kettlebell-row', name: 'One-arm kettlebell row', equipment: 'kettlebell', movement: 'pull', primary: ['back'], secondary: ['biceps'] },
    { id: 'chin-ups-rings', name: 'Chin-ups (rings)', equipment: 'rings', movement: 'pull', primary: ['back', 'biceps'], secondary: [] },
    { id: 'dumbbell-flyes', name: 'Dumbbell flyes', equipment: 'dumbbell', movement: 'push', primary: ['chest'], secondary: [] },
    { id: 'air-squats', name: 'Air squats', equipment: 'bodyweight', movement: 'squat', primary: ['quads', 'glutes'], secondary: [] },
    { id: 'hanging-knee-raises', name: 'Hanging knee raises', equipment: 'pull-up-bar', movement: 'core', primary: ['core'], secondary: [] },
  ],
};

test('test_an_antagonist_comes_first', () => {
  const rows = suggestPairs(catalogue, [{ exerciseId: 'push-ups' }], { limit: 5 });
  assert.equal(rows[0].exercise, 'Push-ups');
  assert.equal(rows[0].partners[0].status, 'antagonist');
  assert.equal(rows[0].partners[0].name, 'Chin-ups (rings)');
});

test('test_a_pull_wants_a_push', () => {
  const rows = suggestPairs(catalogue, [{ exerciseId: 'one-arm-kettlebell-row' }], { limit: 5 });
  // Antagonists first, alphabetical inside the same rank; the pull that shares the back is gone.
  assert.deepEqual(rows[0].partners.map((p) => p.name), ['Dips', 'Dumbbell flyes', 'Push-ups', 'Air squats', 'Hanging knee raises']);
  assert.deepEqual(rows[0].partners.map((p) => p.status), ['antagonist', 'antagonist', 'antagonist', 'neutral', 'neutral']);
});

test('test_a_shared_primary_group_is_never_suggested', () => {
  const rows = suggestPairs(catalogue, [{ exerciseId: 'push-ups' }], { limit: 10 });
  const names = rows[0].partners.map((p) => p.name);
  assert.ok(!names.includes('Dips'), 'Dips shares the chest with Push-ups');
  assert.ok(!names.includes('Dumbbell flyes'), 'flyes share the chest too');
});

test('test_the_equipment_filter_applies', () => {
  const rows = suggestPairs(catalogue, [{ exerciseId: 'push-ups' }], { limit: 10, equipment: ['kettlebell'] });
  assert.deepEqual(rows[0].partners.map((p) => p.name), ['One-arm kettlebell row']);
});

test('test_an_exercise_already_chosen_is_not_a_partner', () => {
  const rows = suggestPairs(catalogue, [{ exerciseId: 'push-ups' }, { exerciseId: 'chin-ups-rings' }], { limit: 10 });
  assert.ok(!rows[0].partners.some((p) => p.name === 'Chin-ups (rings)'));
  assert.ok(!rows[1].partners.some((p) => p.name === 'Push-ups'));
});

test('test_a_missing_axis_still_answers', () => {
  const rows = suggestPairs(catalogue, [{ exerciseId: 'hanging-knee-raises' }], { limit: 3 });
  assert.equal(rows.length, 1);
  assert.ok(rows[0].partners.length > 0);
});

test('test_missing_equipment_names_an_alternative', () => {
  const rows = alternativesForMissingEquipment(catalogue, [{ exerciseId: 'one-arm-kettlebell-row' }], ['bodyweight', 'rings']);
  assert.equal(rows[0].missing, true);
  assert.ok(rows[0].alternatives.some((a) => a.name === 'Chin-ups (rings)'));
});

test('test_present_equipment_asks_for_nothing', () => {
  const rows = alternativesForMissingEquipment(catalogue, [{ exerciseId: 'push-ups' }], ['bodyweight']);
  assert.equal(rows[0].missing, false);
  assert.deepEqual(rows[0].alternatives, []);
});

test('test_a_circuit_never_repeats_a_primary_group', () => {
  // Measured on his eight: ranking each partner against the seed alone gave three triples with a
  // duplicate. Building the circuit step by step must give none.
  const rows = suggestCircuit(catalogue, { exerciseId: 'push-ups' }, { size: 3 });
  const groups = rows.exercises.flatMap((entry) => entry.primary);
  assert.equal(groups.length, new Set(groups).size, `duplicate in ${JSON.stringify(rows.exercises.map((e) => e.name))}`);
  assert.equal(rows.complete, true);
});

test('test_a_circuit_of_one_is_the_seed', () => {
  const rows = suggestCircuit(catalogue, { exerciseId: 'air-squats' }, { size: 1 });
  assert.deepEqual(rows.exercises.map((e) => e.name), ['Air squats']);
  assert.equal(rows.complete, true);
});

test('test_a_circuit_stops_when_nothing_fits', () => {
  const tiny = { exercises: [
    { id: 'a', name: 'A', equipment: 'bodyweight', movement: 'push', primary: ['chest'] },
    { id: 'b', name: 'B', equipment: 'bodyweight', movement: 'push', primary: ['chest'] },
  ] };
  const rows = suggestCircuit(tiny, { exerciseId: 'a' }, { size: 3 });
  assert.equal(rows.exercises.length, 1);
  assert.equal(rows.complete, false);
});

test('test_a_second_back_exercise_is_allowed_when_nothing_else_fits', () => {
  // Ilja, 2026-11-19: a triple that cannot be filled may carry two back exercises. Nothing else may.
  const tight = { exercises: [
    { id: 'chin', name: 'Chin-ups', equipment: 'bodyweight', movement: 'pull', primary: ['back'] },
    { id: 'row', name: 'Row', equipment: 'bodyweight', movement: 'pull', primary: ['back'] },
    { id: 'chest', name: 'Push', equipment: 'bodyweight', movement: 'push', primary: ['chest'] },
  ] };
  const rows = suggestCircuit(tight, { exerciseId: 'chin' }, { size: 3 });
  const names = rows.exercises.map((e) => e.name);
  assert.deepEqual(names, ['Chin-ups', 'Push', 'Row'], 'the back is the group that may repeat');
});

test('test_another_group_never_repeats', () => {
  const tight = { exercises: [
    { id: 'push1', name: 'Push A', equipment: 'bodyweight', movement: 'push', primary: ['chest'] },
    { id: 'push2', name: 'Push B', equipment: 'bodyweight', movement: 'push', primary: ['chest'] },
  ] };
  const rows = suggestCircuit(tight, { exerciseId: 'push1' }, { size: 2 });
  assert.equal(rows.exercises.length, 1, 'a second chest exercise is not allowed');
  assert.equal(rows.complete, false);
});

