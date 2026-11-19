import { useCallback, useEffect, useState } from 'react';

export interface HistorySet {
  reps: number;
  weight?: number;
  /** The block the set belonged to. */
  block?: number;
}

export interface HistoryExercise {
  name: string;
  exerciseId?: string;
  exerciseType?: string;
  volume?: number;
  /** The exercise shared a block with another one. */
  superset?: boolean;
  sets?: HistorySet[];
  completed_sets?: HistorySet[];
}

export interface HistorySession {
  id: string;
  date: string;
  dayType?: string;
  duration?: number;
  rest_seconds?: number;
  totalSets?: number;
  totalVolume?: number;
  total_volume_kg?: number;
  completedExercises?: HistoryExercise[];
}

export interface HistoryState {
  sessions: HistorySession[];
  loading: boolean;
  error: string | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** `19 Nov · 11:41`, in the reader's own time zone. */
export function formatSessionDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A duration as `24 s` below a minute and `6:10` above it. */
export function formatDuration(seconds: number | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${pad(rest)}`;
}

export function tonne(session: HistorySession): number {
  if (typeof session.totalVolume === 'number') return session.totalVolume;
  if (typeof session.total_volume_kg === 'number') return session.total_volume_kg;
  return 0;
}

export function setList(exercise: HistoryExercise): HistorySet[] {
  if (Array.isArray(exercise.sets)) return exercise.sets;
  if (Array.isArray(exercise.completed_sets)) return exercise.completed_sets;
  return [];
}

export function sessionSets(session: HistorySession): number {
  if (typeof session.totalSets === 'number') return session.totalSets;
  return (session.completedExercises ?? []).reduce((sum, exercise) => sum + setList(exercise).length, 0);
}

/**
 * The exercise the session was about: a base exercise first, then the one with the most sets, then
 * the first one done.
 */
export function mainExercise(session: HistorySession, baseIds: string[]): string {
  const exercises = session.completedExercises ?? [];
  if (exercises.length === 0) return '—';

  const base = exercises.find(
    (exercise) => exercise.exerciseId !== undefined && baseIds.includes(exercise.exerciseId)
  );
  if (base) return base.name;

  return exercises
    .map((exercise) => ({ name: exercise.name, sets: setList(exercise).length }))
    .sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name))[0].name;
}

/** `9×20, 6×20, 6×20` — reps first, the load after the multiplication sign. */
export function setSummary(exercise: HistoryExercise): string {
  const sets = setList(exercise);
  if (sets.length === 0) return '—';
  return sets
    .map((set) =>
      set.weight === undefined ? `${set.reps}` : `${set.reps}×${set.weight}`
    )
    .join(', ');
}

async function reasonFor(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object') {
      const record = body as { error?: unknown; details?: unknown };
      const message = typeof record.details === 'string' ? record.details : record.error;
      if (typeof message === 'string' && message.trim() !== '') return message.trim();
    }
  } catch {
    // The body was not JSON; the status line names the reason then.
  }
  return response.statusText || `status ${response.status}`;
}

const cache = new Map<string, HistorySession[]>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function invalidateHistory(userId: string): void {
  cache.delete(userId);
  notify();
}

export function useHistory(userId: string) {
  const [state, setState] = useState<HistoryState>({ sessions: [], loading: true, error: null });

  const reload = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const response = await fetch(`/api/workout-sessions/${encodeURIComponent(userId)}`);
      if (!response.ok) throw new Error(await reasonFor(response));
      const payload: unknown = await response.json();
      const sessions = Array.isArray(payload) ? (payload as HistorySession[]) : [];
      sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      cache.set(userId, sessions);
      setState({ sessions, loading: false, error: null });
      notify();
    } catch (cause: unknown) {
      setState({
        sessions: [],
        loading: false,
        error: cause instanceof Error ? cause.message : String(cause)
      });
    }
  }, [userId]);

  useEffect(() => {
    const cached = cache.get(userId);
    if (cached) {
      setState({ sessions: cached, loading: false, error: null });
      return;
    }
    void reload();
  }, [reload, userId]);

  const remove = useCallback(
    async (sessionId: string) => {
      const response = await fetch(`/api/workout-session/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error(await reasonFor(response));

      cache.delete(userId);
      setState((previous) => {
        const sessions = previous.sessions.filter((session) => session.id !== sessionId);
        cache.set(userId, sessions);
        return { ...previous, sessions };
      });
      notify();
    },
    [userId]
  );

  return { ...state, reload, remove };
}
