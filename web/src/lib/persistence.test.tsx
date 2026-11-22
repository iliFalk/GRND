import { afterEach, expect, it, vi } from 'vitest';
import { STALE_AFTER_MS, isStale, readSaved, readTheme, writeSaved, writeTheme } from './persistence';

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    }
  } as Storage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

it('test_a_workout_from_this_evening_is_still_resumable', () => {
  const now = 1_700_000_000_000;
  expect(isStale(now - 60_000, now)).toBe(false);
  expect(isStale(now - STALE_AFTER_MS + 1_000, now)).toBe(false);
});

it('test_a_workout_from_yesterday_is_not', () => {
  const now = 1_700_000_000_000;
  expect(isStale(now - STALE_AFTER_MS - 1_000, now)).toBe(true);
});

it('test_a_missing_stamp_reads_as_stale', () => {
  expect(isStale(Number.NaN, 1_700_000_000_000)).toBe(true);
});

it('test_a_workout_comes_back_from_the_storage', () => {
  vi.stubGlobal('window', { localStorage: fakeStorage() });
  const now = 1_700_000_000_000;

  writeSaved('grnd-workout-1', { block: 2, sets: 3 }, 90, now);
  const back = readSaved<{ block: number; sets: number }>('grnd-workout-1', now + 1_000);

  expect(back?.value).toEqual({ block: 2, sets: 3 });
  expect(back?.elapsed).toBe(90);
});

it('test_a_workout_older_than_the_cutoff_is_dropped', () => {
  vi.stubGlobal('window', { localStorage: fakeStorage() });
  const now = 1_700_000_000_000;

  writeSaved('grnd-workout-1', { block: 1, sets: 1 }, 10, now);
  expect(readSaved('grnd-workout-1', now + STALE_AFTER_MS + 1_000)).toBeNull();
});

it('test_the_theme_he_picked_is_stored_and_read_back', () => {
  vi.stubGlobal('window', { localStorage: fakeStorage() });

  writeTheme('arc');
  expect(readTheme()).toBe('arc');
});
