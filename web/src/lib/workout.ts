/**
 * The Sets mode of docs/ROADMAP.md §1a, in blocks.
 *
 * Ilja, 2026-11-18: repetitions on the fly — the pause is the set boundary, the rest counts up, and
 * the workout saves once at the end.
 * Ilja, 2026-11-19: the workout is a LIST. Every exercise keeps its own counter and its own set
 * count; you count repetitions in one, switch to the next without a pause, and one pause closes every
 * open counter as one block. Two closed exercises in a block are a superset, three a giant set — the
 * app does not need a mode for it, it follows from the block.
 *
 * The state is plain data so the rules can be tested without a screen.
 */

export interface WorkoutSet {
  reps: number;
  /** Load ADDED to the body for a bodyweight exercise, the whole load for a weighted one. */
  weight?: number;
  /** The block the set belonged to: sets of one block were done back to back. */
  block?: number;
}

export interface WorkoutChoice {
  id: string;
  name: string;
  weight?: number;
}

export interface WorkoutExercise extends WorkoutChoice {
  sets: WorkoutSet[];
  /** Repetitions counted in the open counter. */
  counter: number;
}

export interface WorkoutState {
  exercises: WorkoutExercise[];
  /** Index of the exercise the counter panel is on. */
  active: number;
  startedAt: number;
  /** Seconds spent resting so far, accumulated when a rest ends. */
  restSeconds: number;
  /** The block being filled; it grows by one after every rest. */
  block: number;
  /** When the rest began, in ms. `null` while a block is being filled. */
  restingSince: number | null;
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
      counter: 0
    };
  });

  return { exercises, active: 0, startedAt: now, restSeconds: 0, block: 1, restingSince: null };
}

export function activeExercise(state: WorkoutState): WorkoutExercise | undefined {
  return state.exercises[state.active];
}

/** The counter panel moves to another exercise; nothing is closed by moving. */
export function selectExercise(state: WorkoutState, index: number): WorkoutState {
  if (!state.exercises[index] || state.restingSince !== null) return state;
  return { ...state, active: index };
}

/** +1 and +3 go to the exercise the panel is on. A count below zero is not a repetition. */
export function countReps(state: WorkoutState, amount: number): WorkoutState {
  if (!Number.isFinite(amount) || amount <= 0) return state;
  const exercise = state.exercises[state.active];
  if (!exercise || state.restingSince !== null) return state;

  const exercises = [...state.exercises];
  exercises[state.active] = { ...exercise, counter: exercise.counter + Math.floor(amount) };
  return { ...state, exercises };
}

export function isResting(state: WorkoutState): boolean {
  return state.restingSince !== null;
}

export function elapsedSeconds(state: WorkoutState, now: number): number {
  return Math.max(0, Math.floor((now - state.startedAt) / 1000));
}

/**
 * A workout that survived a closed app: the seconds it already ran are kept, the clock continues from
 * now, and a rest that was interrupted is over — nobody rests for the hours the app was shut.
 */
export function resumeWorkout(state: WorkoutState, elapsed: number, now: number): WorkoutState {
  return {
    ...state,
    startedAt: now - Math.max(0, Math.round(elapsed)) * 1000,
    restingSince: null
  };
}

/** How many exercises the current block has written so far. */
export function openCounters(state: WorkoutState): number {
  return state.exercises.filter((exercise) => exercise.counter > 0).length;
}

/**
 * The pause closes every open counter as one block and starts the rest. A block with two exercises is
 * a superset; a pause with nothing counted closes nothing and starts no rest.
 */
export function pause(state: WorkoutState, now: number): WorkoutState {
  if (state.restingSince !== null) return state;

  const filled = state.exercises.filter((exercise) => exercise.counter > 0);
  if (filled.length === 0) return state;

  const exercises = state.exercises.map((exercise) => {
    if (exercise.counter <= 0) return exercise;
    return {
      ...exercise,
      sets: [
        ...exercise.sets,
        {
          reps: exercise.counter,
          block: state.block,
          ...(exercise.weight === undefined ? {} : { weight: exercise.weight })
        }
      ],
      counter: 0
    };
  });

  // The panel stays where it was, so the next block starts on the exercise last counted.
  return { ...state, exercises, restingSince: now };
}

/**
 * Tapping the timer stops the rest and opens the next block: the panel returns to the exercise the
 * last block started on, so a superset repeats in the same order.
 */
export function nextBlock(state: WorkoutState, now: number): WorkoutState {
  if (state.restingSince === null) return state;

  const spent = Math.max(0, Math.floor((now - state.restingSince) / 1000));
  const first = state.exercises.findIndex((exercise) =>
    exercise.sets.some((set) => set.block === state.block)
  );

  return {
    ...state,
    restingSince: null,
    block: state.block + 1,
    active: first === -1 ? state.active : first,
    restSeconds: state.restSeconds + spent
  };
}

export function restSeconds(state: WorkoutState, now: number): number {
  if (state.restingSince === null) return 0;
  return Math.max(0, Math.floor((now - state.restingSince) / 1000));
}

/** Seconds spent resting, as the rests were closed. */
export function totalRestSeconds(state: WorkoutState): number {
  return state.restSeconds;
}

export function setsOf(exercise: WorkoutExercise): number {
  return exercise.sets.length;
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
