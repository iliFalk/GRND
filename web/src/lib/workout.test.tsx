import { expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { WorkoutScreen } from '../components/workout/WorkoutScreen';
import { buildSessionPayload } from './session';
import {
  activeExercise,
  countReps,
  hasWork,
  isLastExercise,
  isResting,
  nextExercise,
  nextSet,
  pause,
  restSeconds,
  startWorkout,
  totalReps,
  totalSets,
  type WorkoutChoice,
  type WorkoutState
} from './workout';

const swing: WorkoutChoice = { id: 'kettlebell-swing', name: 'Kettlebell Swing', weight: 16 };
const pushUps: WorkoutChoice = { id: 'push-ups', name: 'Push-ups' };
const start = 1_700_000_000_000;

function counted(reps: number, choices: WorkoutChoice[] = [swing]): WorkoutState {
  return countReps(startWorkout(choices, start), reps);
}

it('test_a_pause_closes_the_set_with_the_reps_counted', () => {
  const closed = pause(counted(12), start + 30_000);
  expect(activeExercise(closed)?.sets).toEqual([{ reps: 12, weight: 16 }]);
  expect(activeExercise(closed)?.counter).toBe(0);
});

it('test_a_pause_with_no_reps_closes_nothing', () => {
  const state = startWorkout([swing], start);
  expect(pause(state, start + 5_000)).toBe(state);
  expect(hasWork(pause(state, start + 5_000))).toBe(false);
});

it('test_the_rest_starts_at_the_pause_and_counts_up', () => {
  const resting = pause(counted(10), start);
  expect(isResting(resting)).toBe(true);
  expect(restSeconds(resting, start)).toBe(0);
  expect(restSeconds(resting, start + 45_000)).toBe(45);
});

it('test_the_next_set_starts_from_a_zeroed_counter', () => {
  const resting = pause(counted(10), start);
  const next = nextSet(resting, start + 30_000);
  expect(isResting(next)).toBe(false);
  expect(activeExercise(next)?.counter).toBe(0);
  expect(activeExercise(next)?.sets).toEqual([{ reps: 10, weight: 16 }]);
});

it('test_the_pauses_are_timed_apart_from_the_work', () => {
  const first = pause(counted(10), start);
  const afterRest = nextSet(first, start + 45_000);
  const second = pause(countReps(afterRest, 8), start + 60_000);

  expect(second.restSeconds).toBe(45);
});

it('test_one_weight_for_the_whole_exercise', () => {
  const first = pause(counted(10), start);
  const second = pause(countReps(nextSet(first, start + 30_000), 8), start + 60_000);
  expect(activeExercise(second)?.sets).toEqual([
    { reps: 10, weight: 16 },
    { reps: 8, weight: 16 }
  ]);
  expect(totalReps(second)).toBe(18);
});

it('test_a_count_of_zero_or_below_adds_nothing', () => {
  expect(activeExercise(counted(5))?.counter).toBe(5);
  expect(activeExercise(countReps(counted(5), 0))?.counter).toBe(5);
  expect(activeExercise(countReps(counted(5), -3))?.counter).toBe(5);
});

it('test_a_bodyweight_exercise_carries_no_weight_on_its_sets', () => {
  const closed = pause(counted(15, [pushUps]), start);
  expect(activeExercise(closed)?.weight).toBeUndefined();
  expect(activeExercise(closed)?.sets).toEqual([{ reps: 15 }]);
});

it('test_each_exercise_keeps_its_own_weight', () => {
  const state = startWorkout([swing, pushUps], start);
  expect(state.exercises.map((exercise) => exercise.weight)).toEqual([16, undefined]);
});

it('test_next_exercise_needs_a_closed_set', () => {
  const state = startWorkout([swing, pushUps], start);
  expect(nextExercise(state)).toBe(state);
});

it('test_next_exercise_moves_on_and_keeps_the_first_exercise', () => {
  const first = pause(counted(10, [swing, pushUps]), start);
  const moved = nextExercise(nextSet(first, start + 20_000));

  expect(moved.active).toBe(1);
  expect(moved.exercises[0].sets).toEqual([{ reps: 10, weight: 16 }]);
  expect(isLastExercise(moved)).toBe(true);
  expect(activeExercise(moved)?.name).toBe('Push-ups');
});

it('test_the_last_exercise_has_nowhere_to_go', () => {
  const onLast = nextExercise(nextSet(pause(counted(10, [swing, pushUps]), start), start + 20_000));
  expect(nextExercise(onLast)).toBe(onLast);
});

it('test_no_closed_set_is_nothing_to_save', () => {
  expect(buildSessionPayload(startWorkout([swing, pushUps], start), '931142831')).toBeNull();
});

it('test_the_payload_carries_every_exercise_that_was_done', () => {
  const first = nextExercise(nextSet(pause(counted(10, [swing, pushUps]), start), start + 30_000));
  const done = pause(countReps(first, 12), start + 120_000);
  const payload = buildSessionPayload(done, '931142831', new Date(start + 180_000));

  expect(payload?.duration).toBe(180);
  expect(payload?.dayType).toBe('STANDARD');
  expect(totalSets(done)).toBe(2);
  expect(payload?.completedExercises).toEqual([
    { exerciseId: 'kettlebell-swing', name: 'Kettlebell Swing', sets: [{ reps: 10, weight: 16 }] },
    { exerciseId: 'push-ups', name: 'Push-ups', sets: [{ reps: 12 }] }
  ]);
});

it('test_an_exercise_picked_but_never_done_is_not_in_the_payload', () => {
  const onlyFirst = nextExercise(nextSet(pause(counted(10, [swing, pushUps]), start), start + 30_000));
  const payload = buildSessionPayload(onlyFirst, '931142831');

  expect(payload?.completedExercises).toHaveLength(1);
  expect(payload?.completedExercises[0].exerciseId).toBe('kettlebell-swing');
});

it('test_the_workout_screen_opens_on_its_setup_step', () => {
  // No exercise chosen yet, so the screen asks for several instead of showing a counter.
  const html = renderToString(<WorkoutScreen userId="931142831" onSaved={() => {}} />);
  expect(html).toContain('Start a workout');
  expect(html).toContain('Choose the exercises');
});
