const test = require('node:test');
const assert = require('node:assert/strict');
const { suggestPairs } = require('../backend/utils/pairings.js');

// The route must not cap the picker: it passes a limit only when the caller gives one.
test('test_no_limit_answers_the_whole_ranked_list', () => {
  const catalogue = { exercises: [
    { id: 'a', name: 'A push', equipment: 'bodyweight', movement: 'push', primary: ['chest'] },
    { id: 'b', name: 'B pull', equipment: 'bodyweight', movement: 'pull', primary: ['back'] },
    { id: 'c', name: 'C squat', equipment: 'bodyweight', movement: 'squat', primary: ['quads'] },
    { id: 'd', name: 'D push', equipment: 'bodyweight', movement: 'push', primary: ['chest'] },
  ] };
  const rows = suggestPairs(catalogue, [{ exerciseId: 'a' }], {});
  assert.equal(rows[0].partners.length, 3, 'every other exercise is answered');
  assert.equal(rows[0].partners[0].name, 'B pull');
  assert.equal(rows[0].partners[rows[0].partners.length - 1].status, 'overlap');
});

test('test_a_limit_still_cuts_when_asked', () => {
  const catalogue = { exercises: [
    { id: 'a', name: 'A push', equipment: 'bodyweight', movement: 'push', primary: ['chest'] },
    { id: 'b', name: 'B pull', equipment: 'bodyweight', movement: 'pull', primary: ['back'] },
    { id: 'c', name: 'C squat', equipment: 'bodyweight', movement: 'squat', primary: ['quads'] },
  ] };
  assert.equal(suggestPairs(catalogue, [{ exerciseId: 'a' }], { limit: 1 })[0].partners.length, 1);
});
