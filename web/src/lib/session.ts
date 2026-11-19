import type { WorkoutState } from './workout';

/** One session as `POST /api/workout-session` takes it. */
export interface SessionPayload {
  userId: string;
  date: string;
  /** The report counts a circuit apart from the strength band; this is how it knows. */
  dayType: 'STANDARD' | 'CIRCUIT';
  duration: number;
  completedExercises: Array<{
    exerciseId: string;
    name: string;
    sets: Array<{ reps: number; weight?: number }>;
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
 * The body of one save: every exercise that has a closed set, each with its own weight.
 * An exercise that was picked but never done is not in the session.
 */
export function buildSessionPayload(
  state: WorkoutState,
  userId: string,
  now: Date = new Date()
): SessionPayload | null {
  if (!userId) return null;

  const done = state.exercises.filter((exercise) => exercise.sets.length > 0);
  if (done.length === 0) return null;

  return {
    userId,
    date: now.toISOString(),
    dayType: 'STANDARD',
    duration: Math.max(0, Math.round((now.getTime() - state.startedAt) / 1000)),
    completedExercises: done.map((exercise) => ({
      exerciseId: exercise.id,
      name: exercise.name,
      sets: exercise.sets.map((set) => ({
        reps: set.reps,
        ...(set.weight === undefined ? {} : { weight: set.weight })
      }))
    }))
  };
}

/** Posts the session once and reports what the server stored. A refusal throws with its reason. */
export async function saveWorkoutSession(payload: SessionPayload): Promise<SavedSession> {
  const response = await fetch('/api/workout-session', {
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
