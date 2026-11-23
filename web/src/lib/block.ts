/**
 * One block of the grid: four weeks of work, and what it is worth against the block before.
 *
 * Ilja, 2026-11-23: the anchor lives in `data/periodization.json`, the grid is four weeks, and the
 * server owns the arithmetic (`backend/utils/period.js`). This module asks once and keeps the answer.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from './api';

export type Effort = 'failure' | 'near' | 'easy';

/** The three words the tap offers, in the order the screen shows them. */
export const EFFORTS: { id: Effort; label: string; percent: number }[] = [
  { id: 'failure', label: 'To failure', percent: 100 },
  { id: 'near', label: '1–2 left', percent: 90 },
  { id: 'easy', label: '3+ left', percent: 70 }
];

export type Verdict = 'progress' | 'hold' | 'less' | 'down' | 'open';

export interface BlockWeek {
  week: number;
  from: string;
  to: string;
  closed: boolean;
  work: number;
  sessions: number;
  sets: number;
  reps: number;
  /** The change against the week before it, in per cent; `null` for the first week. */
  change: number | null;
}

export interface BlockExercise {
  name: string;
  sets: number;
  reps: number;
  bodyweight: boolean;
  top_weight: number | null;
  compared: boolean;
  delta_sets: number | null;
  delta_reps: number | null;
  delta_top_weight: number | null;
}

export interface BlockBase {
  block: number;
  from: string;
  to: string;
  work: number;
  week_mean: number;
}

export interface BlockData {
  anchor: string;
  block: number;
  week: number;
  from: string;
  to: string;
  closed: boolean;
  weeks: BlockWeek[];
  work: number;
  sessions: number;
  sets: number;
  reps: number;
  /** Work against the base, 100 = the same level. `null` while there is no closed block. */
  work_index: number | null;
  /** The median change of the best set of every exercise, 100 = unchanged. */
  peak_index: number | null;
  /** One row per exercise of this block, with its change against the base. */
  exercises: BlockExercise[];
  verdict: Verdict;
  plateau: boolean;
  /** `level` for a closed block, `pace` while the block is still running. */
  measured: 'level' | 'pace';
  base: BlockBase | null;
  /** The newest session, so the effort tap knows what it is answering for. */
  last_session: { id: string; date: string; effort: string | null } | null;
  monotony: number | null;
}

export interface BlockState {
  data?: BlockData;
  error?: Error;
  loading: boolean;
}

interface CacheEntry {
  data?: BlockData;
  error?: Error;
  promise?: Promise<BlockData>;
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function verdictOr(value: unknown): Verdict {
  const known: Verdict[] = ['progress', 'hold', 'less', 'down', 'open'];
  return known.includes(value as Verdict) ? (value as Verdict) : 'open';
}

function normalize(payload: unknown): BlockData {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const weeks = Array.isArray(record.weeks) ? record.weeks : [];
  const base = record.base && typeof record.base === 'object' ? (record.base as Record<string, unknown>) : null;
  const rows = Array.isArray(record.exercises) ? record.exercises : [];

  return {
    anchor: String(record.anchor ?? ''),
    block: numberOr(record.block, 0),
    week: numberOr(record.week, 1),
    from: String(record.from ?? ''),
    to: String(record.to ?? ''),
    closed: record.closed === true,
    weeks: weeks
      .filter((week): week is Record<string, unknown> => Boolean(week) && typeof week === 'object')
      .map((week) => ({
        week: numberOr(week.week, 1),
        from: String(week.from ?? ''),
        to: String(week.to ?? ''),
        closed: week.closed === true,
        work: numberOr(week.work, 0),
        sessions: numberOr(week.sessions, 0),
        sets: numberOr(week.sets, 0),
        reps: numberOr(week.reps, 0),
        change: numberOrNull(week.change)
      })),
    work: numberOr(record.work, 0),
    sessions: numberOr(record.sessions, 0),
    sets: numberOr(record.sets, 0),
    reps: numberOr(record.reps, 0),
    work_index: numberOrNull(record.work_index),
    peak_index: numberOrNull(record.peak_index),
    exercises: rows
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
      .map((row) => ({
        name: String(row.name ?? ''),
        sets: numberOr(row.sets, 0),
        reps: numberOr(row.reps, 0),
        bodyweight: row.bodyweight === true,
        top_weight: numberOrNull(row.top_weight),
        compared: row.compared === true,
        delta_sets: numberOrNull(row.delta_sets),
        delta_reps: numberOrNull(row.delta_reps),
        delta_top_weight: numberOrNull(row.delta_top_weight)
      })),
    verdict: verdictOr(record.verdict),
    plateau: record.plateau === true,
    measured: record.measured === 'level' ? 'level' : 'pace',
    base: base
      ? {
          block: numberOr(base.block, 0),
          from: String(base.from ?? ''),
          to: String(base.to ?? ''),
          work: numberOr(base.work, 0),
          week_mean: numberOr(base.week_mean, 0)
        }
      : null,
    last_session:
      record.last_session && typeof record.last_session === 'object'
        ? {
            id: String((record.last_session as Record<string, unknown>).id ?? ''),
            date: String((record.last_session as Record<string, unknown>).date ?? ''),
            effort:
              typeof (record.last_session as Record<string, unknown>).effort === 'string'
                ? String((record.last_session as Record<string, unknown>).effort)
                : null
          }
        : null,
    monotony: numberOrNull(record.monotony)
  };
}

const cache = new Map<string, CacheEntry>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeBlock(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getBlockState(userId: string): BlockState {
  const entry = cache.get(userId);
  if (entry?.data) return { data: entry.data, loading: false };
  if (entry?.error) return { error: entry.error, loading: false };
  return { loading: true };
}

export function invalidateBlock(userId: string): void {
  cache.delete(userId);
  notify();
}

export function loadBlock(userId: string): Promise<BlockData> {
  const existing = cache.get(userId);
  if (existing?.data) return Promise.resolve(existing.data);
  if (existing?.promise) return existing.promise;

  const promise = apiFetch(`/api/block/${encodeURIComponent(userId)}`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`/api/block/ returned ${response.status}`);
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

/** How hard the last session was, in one tap. The journal keeps it; the next read shows the change. */
export async function recordEffort(sessionId: string, effort: Effort, exercise?: string): Promise<void> {
  const response = await apiFetch(`/api/workout-session/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(exercise === undefined ? { effort } : { effort, exercise })
  });
  if (!response.ok) throw new Error(`the effort was not saved (${response.status})`);
}

export function useBlock(userId: string) {
  const [state, setState] = useState<BlockState>(() => getBlockState(userId));

  useEffect(() => {
    let active = true;
    const sync = () => {
      if (!active) return;
      const next = getBlockState(userId);
      setState(next);
      // A dropped cache (a saved session, a retry) leaves the state loading: the read starts again.
      if (next.loading) void loadBlock(userId).catch(() => {});
    };

    const unsubscribe = subscribeBlock(sync);
    sync();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  const reload = useCallback(() => {
    invalidateBlock(userId);
    void loadBlock(userId).catch(() => {
      // The state carries the error; the view offers a retry.
    });
  }, [userId]);

  return useMemo(() => ({ ...state, reload }), [state, reload]);
}
