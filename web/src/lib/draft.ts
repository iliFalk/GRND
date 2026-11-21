/**
 * The running workout, kept on the server.
 *
 * Closing the Mini App keeps the phone's own storage; killing Telegram does not — the client drops the
 * WebView store with the process (measured 2026-11-21). A draft on the server is read by whichever open
 * follows, so the server is the truth and the phone's copy is the fast path.
 */
import { useEffect, useRef } from 'react';

export type DraftMode = 'sets' | 'amrap';

/** Ilja, 2026-11-21: written shortly after the last tap — not on every tap, not once a minute. */
export const DRAFT_DELAY_MS = 500;

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
 * Writes the draft half a second after the last change, and at once when the page hides: a workout
 * abandoned with a tap must still be on the server, and a series of taps costs one request.
 */
export function useDraftSync<T>(
  userId: string,
  mode: DraftMode,
  state: T | null,
  elapsedAt: (state: T, now: number) => number
): void {
  const elapsedRef = useRef(elapsedAt);
  elapsedRef.current = elapsedAt;

  useEffect(() => {
    if (!state) return;

    let timer: number | undefined;
    const flush = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      const now = Date.now();
      void saveDraft(userId, { mode, elapsed: elapsedRef.current(state, now), state });
    };

    timer = window.setTimeout(flush, DRAFT_DELAY_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [mode, state, userId]);
}

export async function clearDraft(userId: string): Promise<void> {
  try {
    await fetch(`/api/workout-draft/${encodeURIComponent(userId)}`, { method: 'DELETE' });
  } catch {
    // A stale draft expires on its own after a day.
  }
}
