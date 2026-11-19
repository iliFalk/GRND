const test = require('node:test');
const assert = require('node:assert/strict');

const { mergePlanWeeks } = require('../backend/utils/planMerge');

const stored = [
  {
    id: 'plan-1-w1',
    planId: 'plan-1',
    weekNumber: 1,
    days: [
      { id: 'plan-1-w1-d1', weekId: 'plan-1-w1', dayOfWeek: 'Monday', dayType: 'Rest', blocks: [] },
      { id: 'plan-1-w1-d2', weekId: 'plan-1-w1', dayOfWeek: 'Tuesday', dayType: 'Rest', blocks: [] }
    ]
  }
];

/** What plans.ts sends: the fields the editor renders, and nothing else. */
function editorWeek() {
  return {
    id: 'plan-1-w1',
    weekNumber: 1,
    days: [
      {
        id: 'plan-1-w1-d1',
        name: 'Monday',
        dayType: 'STANDARD',
        blocks: [{ id: 'b1', blockType: 'Standard', exercises: [{ name: 'Air squats', sets: 3, reps: 10 }] }]
      }
    ]
  };
}

test('test_a_save_keeps_the_fields_the_editor_does_not_know', () => {
  const [week] = mergePlanWeeks(stored, [editorWeek()]);
  const [day] = week.days;

  assert.equal(week.planId, 'plan-1');
  assert.equal(day.weekId, 'plan-1-w1');
  assert.equal(day.dayOfWeek, 'Monday');
});

test('test_a_save_stores_what_the_editor_changed', () => {
  const [week] = mergePlanWeeks(stored, [editorWeek()]);
  const [day] = week.days;

  assert.equal(day.dayType, 'STANDARD');
  assert.equal(day.name, 'Monday');
  assert.equal(day.blocks.length, 1);
  assert.equal(day.blocks[0].exercises[0].name, 'Air squats');
});

test('test_a_removed_day_is_not_brought_back', () => {
  const [week] = mergePlanWeeks(stored, [editorWeek()]);
  assert.deepEqual(week.days.map((day) => day.id), ['plan-1-w1-d1']);
});

test('test_a_new_day_arrives_as_it_was_sent', () => {
  const week = editorWeek();
  week.days.push({ id: 'draft-day-1', name: 'Friday', dayType: 'CIRCUIT', blocks: [] });
  const [merged] = mergePlanWeeks(stored, [week]);
  const added = merged.days[1];

  assert.deepEqual(added, { id: 'draft-day-1', name: 'Friday', dayType: 'CIRCUIT', blocks: [] });
});

test('test_a_week_without_a_stored_twin_is_stored_as_sent', () => {
  const fresh = [{ id: 'plan-2-w1', weekNumber: 1, days: [] }];
  assert.deepEqual(mergePlanWeeks(stored, fresh), fresh);
});

test('test_no_weeks_in_the_payload_keeps_the_stored_ones', () => {
  assert.equal(mergePlanWeeks(stored, undefined), stored);
});
