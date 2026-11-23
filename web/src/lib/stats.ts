/**
 * The statistics of a block: sets, reps, the weight each exercise carried, and the difference to the
 * block before.
 *
 * Ilja, 2026-11-22: the dashboard answers «how many sets, how many reps, what weight», in blocks of four
 * weeks and four months, and each number says what changed against the block before it. The server owns
 * the arithmetic (`backend/utils/stats.js`); this module asks it once per block and keeps the answer.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from './api';
import { readStatsPeriod, writeStatsPeriod } from './persistence';

export const PERIODS = ['4w', '4m'] as const;
export type Period = (typeof PERIODS)[number];

/** The word on the chip: a training block and a season. */
export const PERIOD_LABELS: Record<Period, string> = {
  '4w': '4W',
  '4m': '4M'
};

export const DEFAULT_PERIOD: Period = '4w';

export function isPeriod(value: unknown): value is Period {
  return typeof value === 'string' && (PERIODS as readonly string[]).includes(value);
}

export interface StatsExercise {
  name: string;
  sets: number;
  reps: number;
  /** The body carries the load: there is no weight to name. */
  bodyweight: boolean;
  top_weight: number | null;
  last_weight: number | null;
  /** The earlier block carried this movement, so the differences mean something. */
  compared: boolean;
  delta_sets: number | null;
  delta_reps: number | null;
  delta_top_weight: number | null;
}

export interface StatsData {
  period: Period;
  days: number;
  from: string;
  to: string;
  /** The block the differences are measured against: the same length, ending where this one begins. */
  before_from: string;
  before_to: string;
  sessions: number;
  sets: number;
  reps: number;
  delta_sessions: number | null;
  delta_sets: number | null;
  delta_reps: number | null;
  exercises: StatsExercise[];
}

export interface StatsState {
  data?: StatsData;
  error?: Error;
  loading: boolean;
}

interface CacheEntry {
  data?: StatsData;
  error?: Error;
  promise?: Promise<StatsData>;
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function weightOr(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalize(payload: unknown): StatsData {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const rows = Array.isArray(record.exercises) ? record.exercises : [];

  return {
    period: isPeriod(record.period) ? record.period : DEFAULT_PERIOD,
    days: numberOr(record.days, 0),
    from: String(record.from ?? ''),
    to: String(record.to ?? ''),
    before_from: String(record.before_from ?? ''),
    before_to: String(record.before_to ?? ''),
    sessions: numberOr(record.sessions, 0),
    sets: numberOr(record.sets, 0),
    reps: numberOr(record.reps, 0),
    delta_sessions: weightOr(record.delta_sessions),
    delta_sets: weightOr(record.delta_sets),
    delta_reps: weightOr(record.delta_reps),
    exercises: rows
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
      .map((row) => ({
        name: String(row.name ?? ''),
        sets: numberOr(row.sets, 0),
        reps: numberOr(row.reps, 0),
        bodyweight: row.bodyweight === true,
        top_weight: weightOr(row.top_weight),
        last_weight: weightOr(row.last_weight),
        compared: row.compared === true,
        delta_sets: weightOr(row.delta_sets),
        delta_reps: weightOr(row.delta_reps),
        delta_top_weight: weightOr(row.delta_top_weight)
      }))
  };
}

const cache = new Map<string, CacheEntry>();
const listeners = new Set<() => void>();

function keyFor(userId: string, period: Period): string {
  return `${userId}|${period}`;
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeStats(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getStatsState(userId: string, period: Period): StatsState {
  const entry = cache.get(keyFor(userId, period));
  if (entry?.data) return { data: entry.data, loading: false };
  if (entry?.error) return { error: entry.error, loading: false };
  return { loading: true };
}

/** Drops every cached window of one account, so the next read asks the server again. */
export function invalidateStats(userId: string): void {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(`${userId}|`)) cache.delete(key);
  }
  notify();
}

export function loadStats(userId: string, period: Period): Promise<StatsData> {
  const key = keyFor(userId, period);
  const existing = cache.get(key);
  if (existing?.data) return Promise.resolve(existing.data);
  if (existing?.promise) return existing.promise;

  const promise = apiFetch(`/api/stats/${encodeURIComponent(userId)}?period=${encodeURIComponent(period)}`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`/api/stats/ returned ${response.status}`);
      return normalize(await response.json());
    })
    .then((data) => {
      cache.set(key, { data });
      notify();
      return data;
    })
    .catch((cause: unknown) => {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      cache.set(key, { error });
      notify();
      throw error;
    });

  cache.set(key, { promise });
  notify();
  return promise;
}

/** The period the app was left on: his own choice, else the month. */
export function initialPeriod(): Period {
  const stored = readStatsPeriod();
  return isPeriod(stored) ? stored : DEFAULT_PERIOD;
}

export function rememberPeriod(period: Period): void {
  writeStatsPeriod(period);
}

export function useStats(userId: string, period: Period) {
  const [state, setState] = useState<StatsState>(() => getStatsState(userId, period));

  useEffect(() => {
    let active = true;
    const sync = () => {
      if (!active) return;
      const next = getStatsState(userId, period);
      setState(next);
      // A dropped cache (a saved workout, a retry) leaves the state loading: the read starts again, and a
      // promise that is already in flight is handed back rather than asked for twice.
      if (next.loading) void loadStats(userId, period).catch(() => {});
    };

    const unsubscribe = subscribeStats(sync);
    sync();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId, period]);

  const reload = useCallback(() => {
    invalidateStats(userId);
    void loadStats(userId, period).catch(() => {
      // The state carries the error; the view offers a retry.
    });
  }, [userId, period]);

  return useMemo(() => ({ ...state, reload }), [state, reload]);
}
