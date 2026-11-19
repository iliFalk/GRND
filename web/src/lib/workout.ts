/**
 * The workout mode of docs/ROADMAP.md §1a — repetitions on the fly.
 *
 * Ilja's flow, kept as it was decided on 2026-11-18:
 *   1. pick one exercise from the catalogue and one weight for it;
 *   2. count repetitions with +1 and +3;
 *   3. press pause: the set closes with the repetitions counted, and the rest timer counts up;
 *   4. tap the timer: the rest stops and the next set begins with a zeroed counter;
 *   5. there is no stop button — the workout ends with "finish", which saves the session.
 *
 * The state is plain data so the rules can be tested without a screen.
 */

export interface WorkoutSet {
  reps: number;
  /** Load ADDED to the body for a bodyweight exercise, the whole load for a weighted one. */
  weight?: number;
}

export interface WorkoutState {
  exerciseId: string;
  name: string;
  /** One weight per exercise; it never changes between sets. */
  weight?: number;
  /** Repetitions counted in the open set. */
  counter: number;
  sets: WorkoutSet[];
  /** When the rest began, in ms. `null` while a set is being counted. */
  restingSince: number | null;
  startedAt: number;
}

export interface WorkoutExerciseEntry {
  id: string;
  name: string;
}

function optionalWeight(weight: number | undefined): number | undefined {
  return typeof weight === 'number' && Number.isFinite(weight) && weight > 0 ? weight : undefined;
}

export function startWorkout(
  entry: WorkoutExerciseEntry,
  weight: number | undefined,
  now: number
): WorkoutState {
  const chosen = optionalWeight(weight);
  return {
    exerciseId: entry.id,
    name: entry.name,
    ...(chosen === undefined ? {} : { weight: chosen }),
    counter: 0,
    sets: [],
    restingSince: null,
    startedAt: now
  };
}

/** +1 and +3. A count below zero is not a repetition, so it never happens. */
export function countReps(state: WorkoutState, amount: number): WorkoutState {
  if (!Number.isFinite(amount) || amount <= 0) return state;
  return { ...state, counter: state.counter + Math.floor(amount) };
}

export function isResting(state: WorkoutState): boolean {
  return state.restingSince !== null;
}

/**
 * The set boundary is the pause: nothing guesses it from a rep count.
 * A pause with no repetitions closes nothing and starts no rest.
 */
export function pause(state: WorkoutState, now: number): WorkoutState {
  if (isResting(state)) return state;
  if (state.counter <= 0) return state;

  const closed: WorkoutSet = {
    reps: state.counter,
    ...(state.weight === undefined ? {} : { weight: state.weight })
  };

  return {
    ...state,
    sets: [...state.sets, closed],
    counter: 0,
    restingSince: now
  };
}

/** Tapping the timer stops the rest and opens the next set. */
export function nextSet(state: WorkoutState): WorkoutState {
  if (!isResting(state)) return state;
  return { ...state, restingSince: null, counter: 0 };
}

export function restSeconds(state: WorkoutState, now: number): number {
  if (state.restingSince === null) return 0;
  return Math.max(0, Math.floor((now - state.restingSince) / 1000));
}

export function totalReps(state: WorkoutState): number {
  return state.sets.reduce((sum, set) => sum + set.reps, 0);
}

/** A workout with no closed set carries no work, so it is not saved. */
export function hasWork(state: WorkoutState): boolean {
  return state.sets.length > 0;
}
