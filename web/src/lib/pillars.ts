import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CatalogueEntry } from './catalogue';

export type PillarStatus = 'below' | 'in' | 'above' | 'high' | 'unknown';

export interface PillarTarget {
  min?: number | null;
  target_low?: number | null;
  target_high?: number | null;
  max?: number | null;
}

export interface PillarExercise {
  name: string;
  sets: number;
  role?: 'base' | 'support';
  power?: boolean;
}

export interface PillarRow {
  id: string;
  label: string;
  movements: string[];
  /** The muscle groups the pillar rests on. */
  groups: string[];
  sets: number;
  /** The part of `sets` done on the base of the pillar. */
  base_sets: number;
  /** The part of `sets` done on power work: jumps, the swing. */
  power_sets: number;
  target: PillarTarget;
  status: PillarStatus;
  short: number;
  exercises: PillarExercise[];
}

export interface DayRow {
  date: string;
  sets: number;
  pillars: Record<string, number>;
}

export interface CircuitRow {
  date: string;
  rounds: number;
  time_under_load: number;
  exercises: string[];
}

export interface PillarsData {
  week_start: string;
  week_end: string;
  sessions: number;
  pillars: PillarRow[];
  /** The seven days of the week and what each carried. */
  days: DayRow[];
  circuits: CircuitRow[];
  circuit_rounds: number;
  outside: PillarExercise[];
  unmapped: PillarExercise[];
}

export interface PillarsState {
  data?: PillarsData;
  error?: Error;
  loading: boolean;
}

interface CacheEntry {
  data?: PillarsData;
  error?: Error;
  promise?: Promise<PillarsData>;
}

/**
 * How much an exercise does for a pillar: a primary group of the pillar counts 2, a secondary 1.
 * Ilja, 2026-11-19: the base comes first, then the stronger impact.
 */
export function impactOn(entry: CatalogueEntry, groups: string[]): number {
  const wanted = new Set(groups.map((group) => group.toLowerCase()));
  const primary = (entry.primary ?? []).filter((group) => wanted.has(group.toLowerCase())).length;
  const secondary = (entry.secondary ?? []).filter((group) => wanted.has(group.toLowerCase())).length;
  return primary * 2 + secondary;
}

/**
 * The order Ilja chose for the category wins; an exercise he has not placed yet falls in behind the
 * placed ones, strongest impact first, then by name.
 */
export function orderForPillar(entries: CatalogueEntry[], groups: string[]): CatalogueEntry[] {
  const place = (entry: CatalogueEntry) =>
    typeof entry.order === 'number' && Number.isFinite(entry.order) ? entry.order : Number.POSITIVE_INFINITY;

  return [...entries].sort((a, b) => {
    // Two unplaced exercises both read Infinity, and Infinity - Infinity is NaN: compare, never subtract.
    const placeA = place(a);
    const placeB = place(b);
    if (placeA !== placeB) return placeA < placeB ? -1 : 1;

    const impact = impactOn(b, groups) - impactOn(a, groups);
    if (impact !== 0) return impact;

    return a.name.localeCompare(b.name);
  });
}

const STATUSES: readonly PillarStatus[] = ['below', 'in', 'above', 'high', 'unknown'];

function normalizeStatus(value: unknown): PillarStatus {
  return STATUSES.includes(value as PillarStatus) ? (value as PillarStatus) : 'unknown';
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalize(payload: unknown): PillarsData {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const rows = Array.isArray(record.pillars) ? record.pillars : [];

  const pillars: PillarRow[] = rows
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .map((row) => ({
      id: String(row.id ?? ''),
      label: String(row.label ?? row.id ?? ''),
      movements: Array.isArray(row.movements) ? row.movements.map(String) : [],
      groups: Array.isArray(row.groups) ? row.groups.map(String) : [],
      sets: numberOr(row.sets, 0),
      base_sets: numberOr(row.base_sets, 0),
      power_sets: numberOr(row.power_sets, 0),
      target: (row.target && typeof row.target === 'object' ? row.target : {}) as PillarTarget,
      status: normalizeStatus(row.status),
      short: numberOr(row.short, 0),
      exercises: Array.isArray(row.exercises)
        ? row.exercises
            .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
            .map((entry) => ({
              name: String(entry.name ?? ''),
              sets: numberOr(entry.sets, 0),
              ...(entry.role === 'base' || entry.role === 'support'
                ? { role: entry.role as 'base' | 'support' }
                : {}),
              ...(entry.power === true ? { power: true } : {})
            }))
        : []
    }));

  const list = (value: unknown): PillarExercise[] =>
    Array.isArray(value)
      ? value
          .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
          .map((entry) => ({ name: String(entry.name ?? ''), sets: numberOr(entry.sets, 0) }))
      : [];

  return {
    week_start: String(record.week_start ?? ''),
    week_end: String(record.week_end ?? ''),
    sessions: numberOr(record.sessions, 0),
    pillars,
    days: Array.isArray(record.days)
      ? record.days
          .filter((day): day is Record<string, unknown> => Boolean(day) && typeof day === 'object')
          .map((day) => ({
            date: String(day.date ?? ''),
            sets: numberOr(day.sets, 0),
            pillars:
              day.pillars && typeof day.pillars === 'object'
                ? (day.pillars as Record<string, number>)
                : {}
          }))
      : [],
    circuits: Array.isArray(record.circuits) ? (record.circuits as CircuitRow[]) : [],
    circuit_rounds: numberOr(record.circuit_rounds, 0),
    outside: list(record.outside),
    unmapped: list(record.unmapped)
  };
}

const cache = new Map<string, CacheEntry>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribePillars(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPillarsState(userId: string): PillarsState {
  const entry = cache.get(userId);
  if (entry?.data) return { data: entry.data, loading: false };
  if (entry?.error) return { error: entry.error, loading: false };
  return { loading: true };
}

/** Drops the cached week, so the next read asks the server again. */
export function invalidatePillars(userId: string): void {
  cache.delete(userId);
  notify();
}

export function loadPillars(userId: string): Promise<PillarsData> {
  const existing = cache.get(userId);
  if (existing?.data) return Promise.resolve(existing.data);
  if (existing?.promise) return existing.promise;

  const promise = fetch(`/api/pillars/${encodeURIComponent(userId)}`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`/api/pillars/ returned ${response.status}`);
      return normalize(await response.json());
    })
    .then((data) => {
      cache.set(userId, { data });
      notify();
      return data;
    })
    .catch((cause: unknown) => {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      cache.set(userId, { error });
      notify();
      throw error;
    });

  cache.set(userId, { promise });
  notify();
  return promise;
}

export function usePillars(userId: string) {
  const [state, setState] = useState<PillarsState>(() => getPillarsState(userId));

  useEffect(() => {
    let active = true;
    const sync = () => {
      if (active) setState(getPillarsState(userId));
    };

    const unsubscribe = subscribePillars(sync);
    sync();
    void loadPillars(userId).catch(() => {
      // The state carries the error; the view offers a retry.
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  const reload = useCallback(() => {
    invalidatePillars(userId);
    void loadPillars(userId).catch(() => {
      // The state carries the error; the view offers a retry.
    });
  }, [userId]);

  return useMemo(() => ({ ...state, reload }), [state, reload]);
}
