import { expect, it } from 'vitest';
import {
  MAX_CHOICES,
  buildAmrapPayload,
  completeRound,
  isTimeUp,
  remainingSeconds,
  setPartial,
  setsFor,
  startAmrap
} from './amrap';

const start = 1_700_000_000_000;
const choices = [
  { id: 'air-squats', name: 'Air squats', reps: 15 },
  { id: 'push-ups', name: 'Push-ups', reps: 10 },
  { id: 'burpees', name: 'Burpees', reps: 5 }
];

it('test_a_round_writes_one_set_to_every_exercise', () => {
  const state = completeRound(completeRound(startAmrap(choices, 600, start)));

  expect(state.rounds).toBe(2);
  expect([0, 1, 2].map((index) => setsFor(state, index))).toEqual([2, 2, 2]);
});

it('test_a_partial_round_counts', () => {
  const finished = completeRound(startAmrap(choices, 600, start));
  const state = setPartial(finished, 2);

  expect(state.rounds).toBe(1);
  expect([0, 1, 2].map((index) => setsFor(state, index))).toEqual([2, 2, 1]);
});

it('test_a_partial_cannot_exceed_the_exercises', () => {
  expect(setPartial(startAmrap(choices, 600, start), 9).partial).toBe(3);
  expect(setPartial(startAmrap(choices, 600, start), -2).partial).toBe(0);
});

it('test_the_time_counts_down_and_stops_at_zero', () => {
  const state = startAmrap(choices, 600, start);

  expect(remainingSeconds(state, start)).toBe(600);
  expect(remainingSeconds(state, start + 90_000)).toBe(510);
  expect(isTimeUp(state, start + 90_000)).toBe(false);
  expect(isTimeUp(state, start + 600_000)).toBe(true);
  expect(remainingSeconds(state, start + 900_000)).toBe(0);
});

it('test_no_more_than_three_exercises_enter_a_circuit', () => {
  const state = startAmrap([...choices, { id: 'dips', name: 'Dips', reps: 5 }], 600, start);
  expect(state.choices).toHaveLength(MAX_CHOICES);
});

it('test_a_circuit_without_a_round_is_nothing_to_save', () => {
  expect(buildAmrapPayload(startAmrap(choices, 600, start), '931142831')).toBeNull();
});

it('test_the_payload_is_a_circuit_with_the_rounds_as_sets', () => {
  const state = setPartial(completeRound(startAmrap(choices, 600, start)), 2);
  const payload = buildAmrapPayload(state, '931142831', new Date(start + 600_000));

  expect(payload?.dayType).toBe('CIRCUIT');
  expect(payload?.duration).toBe(600);
  expect(payload?.rest_seconds).toBe(0);
  expect(payload?.completedExercises).toEqual([
    { exerciseId: 'air-squats', name: 'Air squats', sets: [{ reps: 15 }, { reps: 15 }] },
    { exerciseId: 'push-ups', name: 'Push-ups', sets: [{ reps: 10 }, { reps: 10 }] },
    { exerciseId: 'burpees', name: 'Burpees', sets: [{ reps: 5 }] }
  ]);
});
