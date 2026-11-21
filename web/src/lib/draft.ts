/**
 * The running workout, kept on the server.
 *
 * Closing the Mini App keeps the phone's own storage; killing Telegram does not — the client drops the
 * WebView store with the process (measured 2026-11-21). A draft on the server is read by whichever open
 * follows, so the server is the truth and the phone's copy is the fast path.
 */
import { useEffect, useRef } from 'react';

export type DraftMode = 'sets' | 'amrap';

/** Ilja, 2026-11-21: one write a minute while a workout runs — not one per pause in tapping. */
export const DRAFT_INTERVAL_MS = 60_000;

export interface Draft<T> {
  mode: DraftMode;
  /** Seconds the workout had already run. */
  elapsed: number;
  state: T;
  savedAt?: number;
}

export async function loadDraft<T>(userId: string): Promise<Draft<T> | null> {
  try {
    const response = await fetch(`/api/workout-draft/${encodeURIComponent(userId)}`);
    if (!response.ok) return null;
    const body = (await response.json()) as { draft?: Draft<T> };
    return body?.draft ?? null;
  } catch {
    return null;
  }
}

/** Best effort: a draft that cannot be written costs the resume, never the workout in progress. */
export async function saveDraft<T>(userId: string, draft: Draft<T>): Promise<void> {
  try {
    await fetch(`/api/workout-draft/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft)
    });
  } catch {
    // Offline or refused: the phone copy still holds it.
  }
}

/**
 * Writes the draft once a minute while a workout runs, and at once when the page hides. The interval
 * matters: a debounce would wait for him to stop tapping, so a long set could go an hour unwritten.
 * Only a state that changed since the last write is sent.
 */
export function useDraftSync<T>(
  userId: string,
  mode: DraftMode,
  state: T | null,
  elapsedAt: (state: T, now: number) => number
): void {
  const stateRef = useRef<T | null>(state);
  stateRef.current = state;
  const elapsedRef = useRef(elapsedAt);
  elapsedRef.current = elapsedAt;

  const running = state !== null;

  useEffect(() => {
    if (!running) return;

    let written: T | null = null;
    const flush = () => {
      const current = stateRef.current;
      if (current === null || current === written) return;
      written = current;
      const now = Date.now();
      void saveDraft(userId, { mode, elapsed: elapsedRef.current(current, now), state: current });
    };

    const timer = window.setInterval(flush, DRAFT_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [mode, running, userId]);
}

export async function clearDraft(userId: string): Promise<void> {
  try {
    await fetch(`/api/workout-draft/${encodeURIComponent(userId)}`, { method: 'DELETE' });
  } catch {
    // A stale draft expires on its own after a day.
  }
}
