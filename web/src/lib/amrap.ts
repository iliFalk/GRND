/**
 * The AMRAP block of docs/ROADMAP.md §1c.
 *
 * Ilja, 2026-11-18: fixed time, as many rounds as possible. The time is chosen before the workout and
 * stored nowhere; up to three exercises with the reps of each and no weight; a partial round counts,
 * so the work is never lost. The report measures rounds and time under load, never the strength band.
 */
import type { SessionPayload } from './session';

export interface AmrapChoice {
  id: string;
  name: string;
  /** Repetitions of this exercise in one round. */
  reps: number;
  /**
   * Load, when the exercise takes one. Ilja, 2026-11-19: a circuit may carry weight — without it a
   * dumbbell exercise counted a tonnage of zero.
   */
  weight?: number;
}

export interface AmrapState {
  choices: AmrapChoice[];
  totalSeconds: number;
  startedAt: number;
  /** Rounds finished. */
  rounds: number;
  /** Exercises done inside the unfinished round: 0 to `choices.length`. */
  partial: number;
}

export const MAX_CHOICES = 3;

export function startAmrap(choices: AmrapChoice[], totalSeconds: number, now: number): AmrapState {
  return {
    choices: (Array.isArray(choices) ? choices : []).slice(0, MAX_CHOICES),
    totalSeconds: Math.max(0, Math.round(totalSeconds)),
    startedAt: now,
    rounds: 0,
    partial: 0
  };
}

export function completeRound(state: AmrapState): AmrapState {
  if (state.choices.length === 0) return state;
  return { ...state, rounds: state.rounds + 1, partial: 0 };
}

/** How many exercises of the unfinished round were done. */
export function setPartial(state: AmrapState, count: number): AmrapState {
  const clamped = Math.max(0, Math.min(state.choices.length, Math.floor(count)));
  return { ...state, partial: clamped };
}

export function elapsedSeconds(state: AmrapState, now: number): number {
  return Math.max(0, Math.floor((now - state.startedAt) / 1000));
}

export function remainingSeconds(state: AmrapState, now: number): number {
  return Math.max(0, state.totalSeconds - elapsedSeconds(state, now));
}

export function isTimeUp(state: AmrapState, now: number): boolean {
  return remainingSeconds(state, now) === 0;
}

/** Sets recorded for one exercise: one per finished round, plus one for a round it was inside. */
export function setsFor(state: AmrapState, index: number): number {
  if (state.choices.length === 0) return 0;
  return state.rounds + (index < state.partial ? 1 : 0);
}

/**
 * The body of one circuit session. Each round writes one set to every exercise of the round, so the
 * report reads the rounds from the longest list, and a partial round never disappears.
 */
export function buildAmrapPayload(
  state: AmrapState,
  userId: string,
  now: Date = new Date()
): SessionPayload | null {
  if (!userId || state.choices.length === 0) return null;
  if (state.rounds === 0 && state.partial === 0) return null;

  return {
    userId,
    date: now.toISOString(),
    dayType: 'CIRCUIT',
    duration: Math.max(0, Math.round((now.getTime() - state.startedAt) / 1000)),
    rest_seconds: 0,
    completedExercises: state.choices.map((choice, index) => ({
      exerciseId: choice.id,
      name: choice.name,
      sets: Array.from({ length: setsFor(state, index) }, () => ({
        reps: choice.reps,
        ...(choice.weight === undefined ? {} : { weight: choice.weight })
      }))
    }))
  };
}
