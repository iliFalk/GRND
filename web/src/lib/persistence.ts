/**
 * What survives a closed app.
 *
 * A Mini App is killed without ceremony — the sheet closes, the OS drops the page — so a running
 * workout must be written as it changes and read back on the next open. The same goes for the AMRAP
 * clock and for the theme he picked.
 *
 * `localStorage` is the first home. A WebView that refuses it (private mode, a data store the client
 * does not keep) would otherwise lose everything silently — measured 2026-11-21 on Ilja's phone — so
 * the write falls back to a cookie, which the same data store does keep. Every call swallows its
 * error: a failed save costs the resume, never the workout in progress.
 */

export const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

export const THEME_KEY = 'grnd-theme';

interface Saved {
  version: number;
  savedAt: number;
  elapsed: number;
  value: unknown;
}

export function isStale(savedAt: number, now: number): boolean {
  return !Number.isFinite(savedAt) || now - savedAt > STALE_AFTER_MS;
}

function usableLocalStorage(): Storage | null {
  try {
    const store = window.localStorage;
    const probe = '__grnd_probe__';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch {
    return null;
  }
}

/** The same shape as `Storage`, kept in cookies. A cookie is capped at about 4 KB, which a workout fits. */
function cookieStorage(): Storage | null {
  if (typeof document === 'undefined') return null;

  const prefix = 'grnd_';
  const read = (key: string): string | null => {
    const row = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(`${prefix}${key}=`));
    return row ? decodeURIComponent(row.slice(prefix.length + key.length + 1)) : null;
  };

  const store = {
    get length() {
      return document.cookie === '' ? 0 : document.cookie.split('; ').length;
    },
    clear() {
      // Only the keys this module owns are ever cleared, one by one.
    },
    key(index: number) {
      const row = document.cookie.split('; ')[index];
      return row ? row.split('=')[0] : null;
    },
    getItem(key: string) {
      return read(key);
    },
    setItem(key: string, value: string) {
      document.cookie = `${prefix}${key}=${encodeURIComponent(value)}; path=/; max-age=2592000; SameSite=Lax`;
    },
    removeItem(key: string) {
      document.cookie = `${prefix}${key}=; path=/; max-age=0; SameSite=Lax`;
    }
  };

  return store as unknown as Storage;
}

function storage(): Storage | null {
  return usableLocalStorage() ?? cookieStorage();
}

/** The stored theme, as it was written. */
export function readTheme(): string | null {
  try {
    return storage()?.getItem(THEME_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeTheme(theme: string): void {
  try {
    storage()?.setItem(THEME_KEY, theme);
  } catch {
    // A blocked storage must not stop the shell from choosing a theme.
  }
}

export const STATS_PERIOD_KEY = 'grnd-stats-period';

/** The period the dashboard was left on, as it was written. */
export function readStatsPeriod(): string | null {
  try {
    return storage()?.getItem(STATS_PERIOD_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeStatsPeriod(period: string): void {
  try {
    storage()?.setItem(STATS_PERIOD_KEY, period);
  } catch {
    // A blocked storage costs the remembered choice, not the numbers.
  }
}

/** What was written, or `null` when nothing is there, it is another version, or it is too old. */
export function readSaved<T>(
  key: string,
  now: number
): { value: T; elapsed: number; savedAt: number } | null {
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
    return {
      value: saved.value as T,
      elapsed: Math.max(0, Number(saved.elapsed) || 0),
      savedAt: Number(saved.savedAt) || 0
    };
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
