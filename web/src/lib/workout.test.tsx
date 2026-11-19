import { expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { WorkoutScreen } from '../components/workout/WorkoutScreen';
import { buildSessionPayload } from './session';
import {
  activeExercise,
  countReps,
  hasWork,
  isResting,
  nextBlock,
  openCounters,
  pause,
  restSeconds,
  selectExercise,
  startWorkout,
  totalReps,
  totalSets,
  type WorkoutChoice,
  type WorkoutState
} from './workout';

const chinUps: WorkoutChoice = { id: 'chin-ups-rings', name: 'Chin-ups (rings)', weight: 20 };
const dips: WorkoutChoice = { id: 'dips', name: 'Dips', weight: 20 };
const start = 1_700_000_000_000;

function started(choices: WorkoutChoice[] = [chinUps, dips]): WorkoutState {
  return startWorkout(choices, start);
}

/** One block of a superset: chin-ups counted, then dips, then the pause. */
function supersetBlock(): WorkoutState {
  let state = started();
  state = countReps(state, 6);
  state = selectExercise(state, 1);
  state = countReps(state, 9);
  return pause(state, start + 60_000);
}

it('test_a_pause_closes_every_open_counter_as_one_block', () => {
  const closed = supersetBlock();

  expect(closed.exercises[0].sets).toEqual([{ reps: 6, weight: 20, block: 1 }]);
  expect(closed.exercises[1].sets).toEqual([{ reps: 9, weight: 20, block: 1 }]);
  expect(closed.exercises[0].counter).toBe(0);
  expect(closed.exercises[1].counter).toBe(0);
  expect(totalSets(closed)).toBe(2);
});

it('test_an_exercise_without_reps_is_not_in_the_block', () => {
  let state = started();
  state = countReps(state, 6);
  const closed = pause(state, start + 10_000);

  expect(totalSets(closed)).toBe(1);
  expect(closed.exercises[1].sets).toEqual([]);
  expect(closed.exercises[1].counter).toBe(0);
});

it('test_the_panel_moves_without_closing_anything', () => {
  let state = countReps(started(), 6);
  state = selectExercise(state, 1);

  expect(activeExercise(state)?.name).toBe('Dips');
  expect(state.exercises[0].sets).toEqual([]);
  expect(state.exercises[0].counter).toBe(6);
  expect(openCounters(state)).toBe(1);
});

it('test_a_pause_with_nothing_counted_closes_nothing', () => {
  const state = started();
  expect(pause(state, start + 5_000)).toBe(state);
  expect(hasWork(state)).toBe(false);
});

it('test_the_rest_follows_the_block_and_counts_up', () => {
  const resting = supersetBlock();

  expect(isResting(resting)).toBe(true);
  expect(restSeconds(resting, start + 60_000)).toBe(0);
  expect(restSeconds(resting, start + 105_000)).toBe(45);
});

it('test_the_next_block_starts_with_zeroed_counters', () => {
  const next = nextBlock(supersetBlock(), start + 105_000);

  expect(isResting(next)).toBe(false);
  expect(next.block).toBe(2);
  expect(next.restSeconds).toBe(45);
  expect(next.exercises.map((exercise) => exercise.counter)).toEqual([0, 0]);
  expect(next.exercises.map((exercise) => exercise.sets.length)).toEqual([1, 1]);
});

it('test_a_count_of_zero_or_below_adds_nothing', () => {
  expect(activeExercise(countReps(started(), 0))?.counter).toBe(0);
  expect(activeExercise(countReps(countReps(started(), 5), -3))?.counter).toBe(5);
});

it('test_the_counter_does_not_move_during_a_rest', () => {
  const resting = supersetBlock();
  expect(countReps(resting, 3)).toBe(resting);
  expect(selectExercise(resting, 0)).toBe(resting);
});

it('test_a_bodyweight_exercise_carries_no_weight_on_its_sets', () => {
  const closed = pause(countReps(started([{ id: 'push-ups', name: 'Push-ups' }]), 12), start);
  expect(closed.exercises[0].sets).toEqual([{ reps: 12, block: 1 }]);
});

it('test_the_sets_of_one_exercise_accumulate_over_blocks', () => {
  const second = nextBlock(supersetBlock(), start + 60_000);
  const third = pause(countReps(second, 5), start + 120_000);

  expect(third.exercises[0].sets).toEqual([
    { reps: 6, weight: 20, block: 1 },
    { reps: 5, weight: 20, block: 2 }
  ]);
  expect(totalReps(third)).toBe(20);
});

it('test_no_closed_set_is_nothing_to_save', () => {
  expect(buildSessionPayload(started(), '931142831')).toBeNull();
});

it('test_a_block_of_two_is_a_superset_in_the_payload', () => {
  const payload = buildSessionPayload(supersetBlock(), '931142831', new Date(start + 90_000));

  expect(payload?.dayType).toBe('STANDARD');
  expect(payload?.duration).toBe(90);
  expect(payload?.completedExercises).toEqual([
    {
      exerciseId: 'chin-ups-rings',
      name: 'Chin-ups (rings)',
      superset: true,
      sets: [{ reps: 6, weight: 20, block: 1 }]
    },
    {
      exerciseId: 'dips',
      name: 'Dips',
      superset: true,
      sets: [{ reps: 9, weight: 20, block: 1 }]
    }
  ]);
});

it('test_a_block_of_one_is_not_a_superset', () => {
  const closed = pause(countReps(started(), 6), start);
  const payload = buildSessionPayload(closed, '931142831');

  expect(payload?.completedExercises[0].superset).toBeUndefined();
});

it('test_the_workout_screen_opens_on_its_setup_step', () => {
  // No exercise chosen yet, so the screen asks for several instead of showing a counter.
  const html = renderToString(<WorkoutScreen userId="931142831" onSaved={() => {}} />);
  expect(html).toContain('Start a workout');
  expect(html).toContain('Choose the exercises');
});
