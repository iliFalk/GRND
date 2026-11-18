const test = require('node:test');
const assert = require('node:assert/strict');
const { suggestForReport } = require('../backend/utils/muscleSuggestions.js');

/** A report row shaped like `GET /api/muscle-volume` returns. */
function row(group, sets, min, status) {
  return { group, sets, target: { min, target_low: min, target_high: min * 2, max: min * 2.5 }, status };
}

function names(entry) {
  return entry.suggestions.map((exercise) => exercise.name);
}

test('test_only_below_groups', () => {
  const report = {
    groups: [
      row('chest', 4, 10, 'below'),
      row('back', 12, 10, 'in'),
      row('triceps', 22, 8, 'above'),
      row('core', 30, 6, 'high'),
      row('quads', 3, 10, 'unknown')
    ]
  };
  const result = suggestForReport(report);
  assert.deepEqual(result.map((entry) => entry.group), ['chest']);
});

test('test_short_is_the_gap', () => {
  const report = {
    groups: [
      row('chest', 6.4, 10, 'below'),
      row('shoulders', 2.95, 8, 'below')
    ]
  };
  const result = suggestForReport(report);
  const byGroup = Object.fromEntries(result.map((entry) => [entry.group, entry.short]));
  assert.equal(byGroup.chest, 3.6);
  assert.equal(byGroup.shoulders, 5.1);
  assert.equal(result.find((entry) => entry.group === 'chest').sets, 6.4);
});

test('test_primary_only', () => {
  const report = { groups: [row('shoulders', 0, 8, 'below')] };
  const result = suggestForReport(report);
  const list = names(result[0]);
  assert.ok(list.includes('Kettlebell Press'));
  assert.ok(list.includes('Kettlebell Snatch'));
  assert.ok(list.includes('Turkish Get-Up'));
  // Push-ups, Dips and Burpees only train shoulders as a secondary group.
  assert.ok(!list.includes('Push-ups'));
  assert.ok(!list.includes('Dips'));
  assert.ok(!list.includes('Burpees'));
});

test('test_equipment_filter', () => {
  const report = { groups: [row('chest', 0, 10, 'below')] };
  const bodyweightOnly = suggestForReport(report, { equipment: ['bodyweight'], limit: 10 });
  assert.deepEqual(names(bodyweightOnly[0]), ['Burpees', 'Calisthenics', 'Dips', 'Push-ups']);
  assert.ok(!names(bodyweightOnly[0]).includes('Bench Press'));

  // `any` is allowed only when bodyweight is allowed.
  const taxonomy = {
    exercises: {
      'Any Press': { primary: ['shoulders'], secondary: [], equipment: 'any' },
      'Bell Press': { primary: ['shoulders'], secondary: [], equipment: 'kettlebell' }
    }
  };
  const shoulders = { groups: [row('shoulders', 0, 8, 'below')] };
  assert.deepEqual(names(suggestForReport(shoulders, { taxonomy, equipment: ['kettlebell'] })[0]), ['Bell Press']);
  assert.deepEqual(names(suggestForReport(shoulders, { taxonomy, equipment: ['bodyweight'] })[0]), ['Any Press']);
  assert.deepEqual(
    names(suggestForReport(shoulders, { taxonomy, equipment: ['kettlebell', 'bodyweight'] })[0]),
    ['Any Press', 'Bell Press']
  );
});

test('test_order_and_limit', () => {
  const report = {
    groups: [
      row('calves', 6, 8, 'below'),
      row('chest', 6.8, 10, 'below'),
      row('core', 0, 6, 'below'),
      row('biceps', 4.8, 8, 'below')
    ]
  };
  const result = suggestForReport(report, { limit: 2 });
  assert.deepEqual(result.map((entry) => entry.group), ['core', 'biceps', 'chest', 'calves']);

  for (const entry of result) {
    assert.ok(entry.suggestions.length <= 2, `${entry.group} respects the limit`);
    const list = names(entry);
    assert.deepEqual(list, [...list].sort(), `${entry.group} is sorted by name`);
    assert.equal(new Set(list).size, list.length, `${entry.group} has no duplicate`);
  }

  const unlimited = suggestForReport(report, { limit: 100 });
  const allChest = names(unlimited.find((entry) => entry.group === 'chest'));
  assert.ok(allChest.length > 2);
  assert.deepEqual(allChest, [...allChest].sort());
});

test('test_empty_equipment', () => {
  const report = { groups: [row('chest', 0, 10, 'below')] };
  const none = suggestForReport(report, { equipment: [] });
  assert.equal(none.length, 1);
  assert.equal(none[0].group, 'chest');
  assert.deepEqual(none[0].suggestions, []);

  const unknown = suggestForReport(report, { equipment: ['spaceship'] });
  assert.equal(unknown.length, 1);
  assert.deepEqual(unknown[0].suggestions, []);
});

test('test_empty_report', () => {
  assert.deepEqual(suggestForReport({ groups: [] }), []);
  assert.deepEqual(suggestForReport({}), []);
  assert.deepEqual(suggestForReport(null), []);
  assert.deepEqual(suggestForReport({ groups: [row('chest', 12, 10, 'in')] }), []);
});

test('test_broken_taxonomy_falls_back_to_the_file', () => {
  const report = { groups: [row('back', 0, 10, 'below')] };
  const fallback = suggestForReport(report, { taxonomy: 'no/such/file.json', limit: 10 });
  assert.ok(names(fallback[0]).includes('Pull-ups'));

  const unreadable = suggestForReport(report, { taxonomy: {}, limit: 10 });
  assert.deepEqual(unreadable.map((entry) => entry.group), ['back']);
});
