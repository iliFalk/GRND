import { expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { WorkoutScreen } from '../components/workout/WorkoutScreen';
import { buildSessionPayload } from './session';
import {
  countReps,
  hasWork,
  isResting,
  nextSet,
  pause,
  restSeconds,
  startWorkout,
  totalReps,
  type WorkoutState
} from './workout';

const entry = { id: 'kettlebell-swing', name: 'Kettlebell Swing' };
const start = 1_700_000_000_000;

function counted(reps: number, weight?: number): WorkoutState {
  return countReps(startWorkout(entry, weight, start), reps);
}

it('test_a_pause_closes_the_set_with_the_reps_counted', () => {
  const closed = pause(counted(12, 16), start + 30_000);
  expect(closed.sets).toEqual([{ reps: 12, weight: 16 }]);
  expect(closed.counter).toBe(0);
});

it('test_a_pause_with_no_reps_closes_nothing', () => {
  const state = startWorkout(entry, 16, start);
  expect(pause(state, start + 5_000)).toBe(state);
  expect(hasWork(pause(state, start + 5_000))).toBe(false);
});

it('test_the_rest_starts_at_the_pause_and_counts_up', () => {
  const resting = pause(counted(10, 16), start);
  expect(isResting(resting)).toBe(true);
  expect(restSeconds(resting, start)).toBe(0);
  expect(restSeconds(resting, start + 45_000)).toBe(45);
});

it('test_the_next_set_starts_from_a_zeroed_counter', () => {
  const resting = pause(counted(10, 16), start);
  const next = nextSet(resting);
  expect(isResting(next)).toBe(false);
  expect(next.counter).toBe(0);
  expect(next.sets).toEqual([{ reps: 10, weight: 16 }]);
});

it('test_one_weight_for_the_whole_workout', () => {
  const first = pause(counted(10, 16), start);
  const second = pause(countReps(nextSet(first), 8), start + 60_000);
  expect(second.sets).toEqual([
    { reps: 10, weight: 16 },
    { reps: 8, weight: 16 }
  ]);
  expect(totalReps(second)).toBe(18);
});

it('test_a_count_of_zero_or_below_adds_nothing', () => {
  expect(countReps(counted(5), 0).counter).toBe(5);
  expect(countReps(counted(5), -3).counter).toBe(5);
});

it('test_a_bodyweight_workout_carries_no_weight_on_its_sets', () => {
  const closed = pause(counted(15), start);
  expect(closed.weight).toBeUndefined();
  expect(closed.sets).toEqual([{ reps: 15 }]);
});

it('test_no_closed_set_is_nothing_to_save', () => {
  const state = startWorkout(entry, 16, start);
  expect(buildSessionPayload(state, '931142831')).toBeNull();
});

it('test_the_workout_screen_opens_on_its_setup_step', () => {
  // The screen has no exercise yet, so it asks for one instead of showing a counter.
  const html = renderToString(<WorkoutScreen userId="931142831" onSaved={() => {}} />);
  expect(html).toContain('Start a workout');
  expect(html).toContain('One exercise, one weight');
});

it('test_the_payload_carries_the_catalogue_id_the_name_and_the_sets', () => {
  const closed = pause(counted(12, 16), start + 120_000);
  const payload = buildSessionPayload(closed, '931142831', new Date(start + 180_000));

  expect(payload).not.toBeNull();
  expect(payload?.userId).toBe('931142831');
  expect(payload?.dayType).toBe('STANDARD');
  expect(payload?.duration).toBe(180);
  expect(payload?.completedExercises).toEqual([
    { exerciseId: 'kettlebell-swing', name: 'Kettlebell Swing', sets: [{ reps: 12, weight: 16 }] }
  ]);
});
