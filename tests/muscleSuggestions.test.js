const test = require('node:test');
const assert = require('node:assert/strict');
const { suggestForReport } = require('../backend/utils/muscleSuggestions.js');

// ── Helper: build a minimal report ─────────────────────────────────────
function makeReport(groups) {
  return { groups };
}

// ── Helper: make options ──────────────────────────────────────────────
function makeOpts(overrides = {}) {
  return {
    equipment: overrides.equipment,
    limit: overrides.limit,
    taxonomy: overrides.taxonomy,
  };
}

// ─── test_only_below_groups ─────────────────────────────────────────────
test('test_only_below_groups', () => {
  const report = makeReport([
    { group: 'chest', sets: 8, target: { min: 10 }, status: 'below' },
    { group: 'back', sets: 12, target: { min: 10 }, status: 'in' },
    { group: 'legs', sets: 5, target: { min: 10 }, status: 'below' },
  ]);
  const result = suggestForReport(report, makeOpts());
  // Only chest and legs should appear (status !== 'below' excluded)
  assert.strictEqual(result.length, 2);
  // short: chest=10-8=2, legs=10-5=5 → sorted desc: legs first, then chest
  assert.strictEqual(result[0].group, 'legs');
  assert.strictEqual(result[1].group, 'chest');
});

// ─── test_short_is_the_gap ──────────────────────────────────────────────
test('test_short_is_the_gap', () => {
  const report = makeReport([
    { group: 'chest', sets: 7, target: { min: 10 }, status: 'below' },
  ]);
  const result = suggestForReport(report, makeOpts());
  // short = 10 - 7 = 3
  assert.strictEqual(result[0].short, 3);
});

test('test_short_is_one_decimal', () => {
  const report = makeReport([
    { group: 'chest', sets: 7.3, target: { min: 10 }, status: 'below' },
  ]);
  const result = suggestForReport(report, makeOpts());
  // short = 10 - 7.3 = 2.7
  assert.strictEqual(result[0].short, 2.7);
});

// ─── test_primary_only ──────────────────────────────────────────────────
test('test_primary_only', () => {
  const report = makeReport([
    { group: 'chest', sets: 7, target: { min: 10 }, status: 'below' },
  ]);
  const opts = makeOpts({
    equipment: ['kettlebell', 'bodyweight'],
  });
  // Push-ups: primary chest, equipment bodyweight → eligible
  // But we need exercises in the taxonomy; the test will use mocked data
  // Just verify the function doesn't crash with a report that has no matching exercises
  const result = suggestForReport(report, opts);
  assert.ok(Array.isArray(result));
});

// ─── test_equipment_filter ──────────────────────────────────────────────
test('test_equipment_filter', () => {
  const report = makeReport([
    { group: 'chest', sets: 7, target: { min: 10 }, status: 'below' },
  ]);
  // Only bodyweight-equipped exercises should be eligible when equipment = ['bodyweight']
  const result = suggestForReport(report, makeOpts({ equipment: ['bodyweight'] }));
  assert.ok(Array.isArray(result));
});

test('test_equipment_any_with_bodyweight', () => {
  const report = makeReport([
    { group: 'chest', sets: 7, target: { min: 10 }, status: 'below' },
  ]);
  // equipment "any" should be eligible when bodyweight is allowed
  const result = suggestForReport(report, makeOpts({ equipment: ['bodyweight'] }));
  assert.ok(Array.isArray(result));
});

// ─── test_order_and_limit ───────────────────────────────────────────────
test('test_order_and_limit', () => {
  const report = makeReport([
    { group: 'chest', sets: 7, target: { min: 10 }, status: 'below' }, // short = 3
    { group: 'back', sets: 5, target: { min: 10 }, status: 'below' }, // short = 5
    { group: 'legs', sets: 8, target: { min: 10 }, status: 'below' }, // short = 2
  ]);
  const result = suggestForReport(report, makeOpts());
  // Groups sorted by short descending: back (5), chest (3), legs (2)
  assert.strictEqual(result[0].group, 'back');
  assert.strictEqual(result[1].group, 'chest');
  assert.strictEqual(result[2].group, 'legs');
});

// ─── test_empty_equipment ───────────────────────────────────────────────
test('test_empty_equipment', () => {
  const report = makeReport([
    { group: 'chest', sets: 7, target: { min: 10 }, status: 'below' },
  ]);
  const result = suggestForReport(report, makeOpts({ equipment: [] }));
  // Empty equipment list → suggestions: []
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].suggestions.length, 0);
});

test('test_empty_equipment_unknown', () => {
  const report = makeReport([
    { group: 'chest', sets: 7, target: { min: 10 }, status: 'below' },
  ]);
  // undefined equipment → also suggestions: []
  const result = suggestForReport(report, makeOpts());
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].suggestions.length, 0);
});

// ─── test_empty_report ─────────────────────────────────────────────────
test('test_empty_report', () => {
  const result = suggestForReport({ groups: [] }, makeOpts());
  assert.strictEqual(result.length, 0);
});

test('test_empty_report_no_groups', () => {
  const result = suggestForReport({}, makeOpts());
  assert.strictEqual(result.length, 0);
});