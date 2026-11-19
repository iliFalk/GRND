/**
 * The workout mode of docs/ROADMAP.md §1a — repetitions on the fly, over one or more exercises.
 *
 * Ilja's flow, decided on 2026-11-18 and extended to several exercises on 2026-11-19:
 *   1. pick the exercises from the catalogue and one weight for each;
 *   2. count repetitions with +1 and +3;
 *   3. press pause: the set closes with the repetitions counted, and the rest timer counts up;
 *   4. tap the timer: the rest stops and the next set begins with a zeroed counter;
 *   5. move on with "next exercise" once the current one has a set;
 *   6. there is no stop button — the workout ends with "finish", which saves the session.
 *
 * The state is plain data so the rules can be tested without a screen.
 */

export interface WorkoutSet {
  reps: number;
  /** Load ADDED to the body for a bodyweight exercise, the whole load for a weighted one. */
  weight?: number;
}

export interface WorkoutChoice {
  id: string;
  name: string;
  weight?: number;
}

export interface WorkoutExercise extends WorkoutChoice {
  sets: WorkoutSet[];
  /** Repetitions counted in the open set. */
  counter: number;
  /** When the rest began, in ms. `null` while a set is being counted. */
  restingSince: number | null;
}

export interface WorkoutState {
  exercises: WorkoutExercise[];
  /** Index of the exercise being done. */
  active: number;
  startedAt: number;
  /** Seconds spent resting so far, accumulated when a rest ends. */
  restSeconds: number;
}

function optionalWeight(weight: number | undefined): number | undefined {
  return typeof weight === 'number' && Number.isFinite(weight) && weight > 0 ? weight : undefined;
}

export function startWorkout(choices: WorkoutChoice[], now: number): WorkoutState {
  const exercises: WorkoutExercise[] = (Array.isArray(choices) ? choices : []).map((choice) => {
    const weight = optionalWeight(choice.weight);
    return {
      id: choice.id,
      name: choice.name,
      ...(weight === undefined ? {} : { weight }),
      sets: [],
      counter: 0,
      restingSince: null
    };
  });

  return { exercises, active: 0, startedAt: now, restSeconds: 0 };
}

export function activeExercise(state: WorkoutState): WorkoutExercise | undefined {
  return state.exercises[state.active];
}

/** Rebuilds the active exercise and leaves the others untouched. */
function withActive(
  state: WorkoutState,
  update: (exercise: WorkoutExercise) => WorkoutExercise
): WorkoutState {
  const exercise = state.exercises[state.active];
  if (!exercise) return state;
  const exercises = [...state.exercises];
  exercises[state.active] = update(exercise);
  return { ...state, exercises };
}

/** +1 and +3. A count below zero is not a repetition, so it never happens. */
export function countReps(state: WorkoutState, amount: number): WorkoutState {
  if (!Number.isFinite(amount) || amount <= 0) return state;
  return withActive(state, (exercise) => ({
    ...exercise,
    counter: exercise.counter + Math.floor(amount)
  }));
}

export function isResting(state: WorkoutState): boolean {
  const exercise = activeExercise(state);
  return exercise !== undefined && exercise.restingSince !== null;
}

/**
 * The set boundary is the pause: nothing guesses it from a rep count.
 * A pause with no repetitions closes nothing and starts no rest.
 */
export function pause(state: WorkoutState, now: number): WorkoutState {
  const exercise = activeExercise(state);
  if (!exercise || exercise.restingSince !== null || exercise.counter <= 0) return state;

  return withActive(state, (current) => ({
    ...current,
    sets: [
      ...current.sets,
      {
        reps: current.counter,
        ...(current.weight === undefined ? {} : { weight: current.weight })
      }
    ],
    counter: 0,
    restingSince: now
  }));
}

/**
 * Tapping the timer stops the rest and opens the next set. The rest is added to the total, so the
 * history can say how long the pauses took.
 */
export function nextSet(state: WorkoutState, now: number): WorkoutState {
  const exercise = activeExercise(state);
  if (!exercise || exercise.restingSince === null) return state;

  const spent = Math.max(0, Math.floor((now - exercise.restingSince) / 1000));
  const next = withActive(state, (current) => ({ ...current, restingSince: null, counter: 0 }));
  return { ...next, restSeconds: state.restSeconds + spent };
}

/** Moving on needs one closed set on the current exercise; the last one has nowhere to go. */
export function nextExercise(state: WorkoutState): WorkoutState {
  const exercise = activeExercise(state);
  if (!exercise || exercise.restingSince !== null) return state;
  if (exercise.sets.length === 0) return state;
  if (state.active >= state.exercises.length - 1) return state;
  return { ...state, active: state.active + 1 };
}

export function isLastExercise(state: WorkoutState): boolean {
  return state.exercises.length === 0 || state.active >= state.exercises.length - 1;
}

export function restSeconds(state: WorkoutState, now: number): number {
  const restingSince = activeExercise(state)?.restingSince;
  if (restingSince === null || restingSince === undefined) return 0;
  return Math.max(0, Math.floor((now - restingSince) / 1000));
}

/** Seconds spent resting, as the pauses were closed. */
export function totalRestSeconds(state: WorkoutState): number {
  return state.restSeconds;
}

export function totalSets(state: WorkoutState): number {
  return state.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
}

export function totalReps(state: WorkoutState): number {
  return state.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.reduce((reps, set) => reps + set.reps, 0),
    0
  );
}

/** A workout with no closed set carries no work, so it is not saved. */
export function hasWork(state: WorkoutState): boolean {
  return totalSets(state) > 0;
}
