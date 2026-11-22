import { apiFetch } from './api';
import { elapsedSeconds, type WorkoutState } from './workout';

/** One session as `POST /api/workout-session` takes it. */
export interface SessionPayload {
  userId: string;
  date: string;
  /** The report counts a circuit apart from the strength band; this is how it knows. */
  dayType: 'STANDARD' | 'CIRCUIT';
  duration: number;
  /** Seconds spent on the pauses, so the history can show them apart from the work. */
  rest_seconds: number;
  completedExercises: Array<{
    exerciseId: string;
    name: string;
    /** The exercise shared a block with another one: a superset or a giant set. */
    superset?: boolean;
    sets: Array<{ reps: number; weight?: number; block?: number }>;
  }>;
}

export interface SavedSession {
  id: string;
  date: string;
  dayType?: string;
  totalVolume?: number;
  totalSets?: number;
  completedExercises?: Array<{ name: string; volume?: number }>;
}

/**
 * How many exercises wrote a set in each block. A block of two is a superset, of three a giant set.
 */
function exercisesPerBlock(exercises: WorkoutState['exercises']): Map<number, number> {
  const perBlock = new Map<number, number>();

  for (const exercise of exercises) {
    const blocks = new Set(exercise.sets.map((set) => set.block ?? 0));
    for (const block of blocks) {
      perBlock.set(block, (perBlock.get(block) ?? 0) + 1);
    }
  }

  return perBlock;
}

/**
 * The body of one save: every exercise that has a closed set, each with its own weight, and the block
 * each set belonged to. An exercise that was picked but never done is not in the session.
 */
export function buildSessionPayload(
  state: WorkoutState,
  userId: string,
  now: Date = new Date()
): SessionPayload | null {
  if (!userId) return null;

  const done = state.exercises.filter((exercise) => exercise.sets.length > 0);
  if (done.length === 0) return null;

  const perBlock = exercisesPerBlock(done);

  return {
    userId,
    date: now.toISOString(),
    dayType: 'STANDARD',
    duration: elapsedSeconds(state, now.getTime()),
    rest_seconds: state.restSeconds,
    completedExercises: done.map((exercise) => {
      const sharesABlock = exercise.sets.some((set) => (perBlock.get(set.block ?? 0) ?? 0) > 1);
      return {
        exerciseId: exercise.id,
        name: exercise.name,
        ...(sharesABlock ? { superset: true } : {}),
        sets: exercise.sets.map((set) => ({
          reps: set.reps,
          ...(set.weight === undefined ? {} : { weight: set.weight }),
          ...(set.block === undefined ? {} : { block: set.block })
        }))
      };
    })
  };
}

/** Posts the session once and reports what the server stored. A refusal throws with its reason. */
export async function saveWorkoutSession(payload: SessionPayload): Promise<SavedSession> {
  const response = await apiFetch('/api/workout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let reason = response.statusText || `status ${response.status}`;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object') {
        const record = body as { error?: unknown; details?: unknown };
        const message = typeof record.details === 'string' ? record.details : record.error;
        if (typeof message === 'string' && message.trim() !== '') reason = message.trim();
      }
    } catch {
      // The body was not JSON; the status line names the reason then.
    }
    throw new Error(`POST /api/workout-session returned ${response.status}: ${reason}`);
  }

  const body = (await response.json()) as { session?: SavedSession };
  const session = body?.session;
  if (!session || typeof session.id !== 'string') {
    throw new Error('the server answered without a session id');
  }
  return session;
}
