import { expect, it } from 'vitest';
import { STALE_AFTER_MS, isStale } from './persistence';

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
