import { expect, it } from 'vitest';
import { formatDuration, formatSessionDate, mainExercise, sessionSets, setSummary, tonne } from './history';

const session = {
  id: 's1',
  date: '2026-11-19T11:41:16.078Z',
  duration: 370,
  rest_seconds: 240,
  totalSets: 5,
  totalVolume: 2592,
  completedExercises: [
    { name: 'Dips', exerciseId: 'dips', volume: 2052, sets: [{ reps: 9, weight: 20 }, { reps: 6, weight: 20 }] },
    { name: 'Chin-ups (rings)', exerciseId: 'chin-ups-rings', volume: 540, sets: [{ reps: 6, weight: 20 }] }
  ]
};

it('test_a_pause_longer_than_a_minute_reads_as_minutes', () => {
  expect(formatDuration(370)).toBe('6:10');
  expect(formatDuration(24)).toBe('24 s');
  expect(formatDuration(undefined)).toBe('—');
});

it('test_the_tonnage_falls_back_to_the_prd_field', () => {
  expect(tonne(session)).toBe(2592);
  expect(tonne({ id: 's2', date: session.date, total_volume_kg: 1200 })).toBe(1200);
});

it('test_the_sets_count_falls_back_to_the_exercises', () => {
  expect(sessionSets(session)).toBe(5);
  expect(sessionSets({ id: 's3', date: session.date, completedExercises: session.completedExercises })).toBe(3);
});

it('test_the_main_exercise_is_the_base_one', () => {
  // Dips have more sets, but the base of the session is the chin-up.
  expect(mainExercise(session, ['chin-ups-rings', 'pull-ups'])).toBe('Chin-ups (rings)');
  expect(mainExercise(session, [])).toBe('Dips');
});

it('test_a_set_reads_as_reps_and_the_load', () => {
  expect(setSummary(session.completedExercises[0])).toBe('9×20, 6×20');
  expect(setSummary({ name: 'Push-ups', sets: [{ reps: 12 }, { reps: 10 }] })).toBe('12, 10');
});

it('test_a_date_keeps_its_day_and_clock', () => {
  expect(formatSessionDate('2026-11-19T11:41:16.078Z')).toMatch(/^19 Nov · \d\d:\d\d$/);
  expect(formatSessionDate('not a date')).toBe('—');
});
