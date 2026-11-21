/**
 * What survives a closed app.
 *
 * A Mini App is killed without ceremony — the sheet closes, the OS drops the page — so a running
 * workout must be written as it changes and read back on the next open. The same goes for the AMRAP
 * clock. A browser tab that reloads is the same case, and a storage that refuses (private mode) must
 * never break the screen: every call swallows its error.
 */

export const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

interface Saved {
  version: number;
  savedAt: number;
  elapsed: number;
  value: unknown;
}

export function isStale(savedAt: number, now: number): boolean {
  return !Number.isFinite(savedAt) || now - savedAt > STALE_AFTER_MS;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** What was written, or `null` when nothing is there, it is another version, or it is too old. */
export function readSaved<T>(key: string, now: number): { value: T; elapsed: number } | null {
  const store = storage();
  if (!store) return null;

  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    if (!saved || saved.version !== 1) return null;
    if (isStale(saved.savedAt, now)) {
      store.removeItem(key);
      return null;
    }
    return { value: saved.value as T, elapsed: Math.max(0, Number(saved.elapsed) || 0) };
  } catch {
    return null;
  }
}

export function writeSaved(key: string, value: unknown, elapsed: number, now: number): void {
  const store = storage();
  if (!store) return;

  try {
    const saved: Saved = { version: 1, savedAt: now, elapsed: Math.max(0, Math.round(elapsed)), value };
    store.setItem(key, JSON.stringify(saved));
  } catch {
    // A full or blocked storage costs the resume, never the workout in progress.
  }
}

export function clearSaved(key: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}
