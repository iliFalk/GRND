import { useCallback, useEffect, useState } from 'react';

/** A step of a plan block. The name is the snapshot the plan stored; the catalogue id is optional. */
export interface PlanExercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  /** The catalogue entry, once the plan was written against it. Legacy plans have no id. */
  exerciseId?: string;
}

export interface PlanBlock {
  id: string;
  blockType: string;
  rounds?: number;
  targetTime?: number;
  exercises: PlanExercise[];
}

export interface PlanDay {
  id: string;
  name: string;
  dayType: string;
  blocks: PlanBlock[];
}

export interface PlanWeek {
  id: string;
  weekNumber: number;
  name?: string;
  days: PlanDay[];
}

export interface TrainingPlan {
  id: string;
  name: string;
  description?: string;
  weeks: PlanWeek[];
}

export interface PlansState {
  data?: TrainingPlan[];
  error?: Error;
  loading: boolean;
}

export interface PlansQuery extends PlansState {
  reload: () => void;
}

interface CacheEntry {
  data?: TrainingPlan[];
  error?: Error;
  promise?: Promise<TrainingPlan[]>;
}

/** Plans are not user-scoped: `/api/training-plans` answers the same list for the app. */
let cache: CacheEntry | undefined;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribePlans(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPlansState(): PlansState {
  if (cache?.data) return { data: cache.data, loading: false };
  if (cache?.error) return { error: cache.error, loading: false };
  return { loading: true };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberOr(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeExercise(raw: unknown): PlanExercise | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const name = text(record.name) || text(record.exercise_name);
  if (!name) return null;

  const id = text(record.id) || text(record.exercise_id);
  const exerciseId = text(record.exerciseId);
  const weight = optionalNumber(record.weight);

  return {
    id,
    name,
    sets: numberOr(record.sets ?? record.target_sets, 0),
    reps: numberOr(record.reps ?? record.target_reps, 0),
    ...(weight === undefined ? {} : { weight }),
    ...(exerciseId === '' ? {} : { exerciseId })
  };
}

function normalizeBlock(raw: unknown, index: number): PlanBlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const rounds = optionalNumber(record.rounds ?? record.target_rounds);
  const targetTime = optionalNumber(record.targetTime ?? record.target_time);

  return {
    id: text(record.id) || text(record.block_id) || `block-${index + 1}`,
    blockType: text(record.blockType) || text(record.block_type),
    ...(rounds === undefined ? {} : { rounds }),
    ...(targetTime === undefined ? {} : { targetTime }),
    exercises: Array.isArray(record.exercises)
      ? record.exercises
          .map(normalizeExercise)
          .filter((exercise): exercise is PlanExercise => exercise !== null)
      : []
  };
}

function normalizeDay(raw: unknown, index: number): PlanDay | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const blocks = Array.isArray(record.blocks)
    ? record.blocks
    : Array.isArray(record.workoutBlocks)
      ? record.workoutBlocks
      : [];

  return {
    id: text(record.id) || text(record.day_id) || `day-${index + 1}`,
    name:
      text(record.dayOfWeek) ||
      text(record.day_of_week) ||
      text(record.name) ||
      text(record.day_name) ||
      `Day ${index + 1}`,
    dayType: text(record.dayType) || text(record.day_type),
    blocks: blocks
      .map(normalizeBlock)
      .filter((block): block is PlanBlock => block !== null)
  };
}

function normalizeWeek(raw: unknown, index: number): PlanWeek | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;

  return {
    id: text(record.id) || text(record.week_id) || `week-${index + 1}`,
    weekNumber: numberOr(record.weekNumber ?? record.week_number, index + 1),
    ...(text(record.name) === '' ? {} : { name: text(record.name) }),
    days: Array.isArray(record.days)
      ? record.days.map(normalizeDay).filter((day): day is PlanDay => day !== null)
      : []
  };
}

function normalizePlan(raw: unknown): TrainingPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const id = text(record.id) || text(record.plan_id);
  const name = text(record.name) || text(record.plan_name);
  if (!id || !name) return null;

  return {
    id,
    name,
    ...(text(record.description) === '' ? {} : { description: text(record.description) }),
    weeks: Array.isArray(record.weeks)
      ? record.weeks.map(normalizeWeek).filter((week): week is PlanWeek => week !== null)
      : []
  };
}

function normalizePlans(payload: unknown): TrainingPlan[] {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { plans?: unknown }).plans)
      ? (payload as { plans: unknown[] }).plans
      : [];

  return list
    .map(normalizePlan)
    .filter((plan): plan is TrainingPlan => plan !== null);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return (await response.json()) as T;
}

export function loadTrainingPlans(): Promise<TrainingPlan[]> {
  if (cache?.data) return Promise.resolve(cache.data);
  if (cache?.promise) return cache.promise;

  const promise = fetchJson<unknown>('/api/training-plans')
    .then((payload) => {
      const data = normalizePlans(payload);
      cache = { data };
      notify();
      return data;
    })
    .catch((cause: unknown) => {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      cache = { error };
      notify();
      throw error;
    });

  cache = { promise };
  notify();
  return promise;
}

export function useTrainingPlans(): PlansQuery {
  const [state, setState] = useState<PlansState>(getPlansState);

  useEffect(() => {
    let active = true;
    const sync = () => {
      if (active) setState(getPlansState());
    };

    const unsubscribe = subscribePlans(sync);
    sync();
    void loadTrainingPlans().catch(() => {
      // The state carries the error; the view offers a retry.
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const reload = useCallback(() => {
    void loadTrainingPlans().catch(() => {
      // The state carries the error; the view offers a retry.
    });
  }, []);

  return { ...state, reload };
}
