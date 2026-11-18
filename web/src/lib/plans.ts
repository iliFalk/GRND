import { useCallback, useEffect, useState } from 'react';
import type { CatalogueEntry } from './catalogue';

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

/** The day types the editor stores. The label is only what the screen shows. */
export const DAY_TYPES = ['STANDARD', 'REST', 'CIRCUIT'] as const;
export type DayType = (typeof DAY_TYPES)[number];

const DAY_TYPE_LABELS: Record<DayType, string> = {
  STANDARD: 'Standar',
  REST: 'Rest',
  CIRCUIT: 'Circuit'
};

export function isDayType(value: string): value is DayType {
  return (DAY_TYPES as readonly string[]).includes(value);
}

/** A legacy day type is shown as stored; the editor only ever writes the three known values. */
export function dayTypeLabel(value: string): string {
  return isDayType(value) ? DAY_TYPE_LABELS[value] : value;
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

/** One id per edit, so a re-render never merges two exercises or two blocks written in the screen. */
let draftSequence = 0;

function draftId(prefix: string): string {
  draftSequence += 1;
  return `draft-${prefix}-${Date.now().toString(36)}-${draftSequence}`;
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

/** The body of `PUT /api/training-plans/:planId`: the server replaces `weeks` wholesale. */
export interface PlanUpdateExercise {
  exerciseId?: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
}

export interface PlanUpdateBlock {
  id: string;
  blockType: string;
  rounds?: number;
  targetTime?: number;
  exercises: PlanUpdateExercise[];
}

export interface PlanUpdateDay {
  id: string;
  name: string;
  dayType: string;
  blocks: PlanUpdateBlock[];
}

export interface PlanUpdateWeek {
  id: string;
  weekNumber: number;
  name?: string;
  days: PlanUpdateDay[];
}

export interface PlanUpdatePayload {
  id: string;
  name: string;
  description?: string;
  weeks: PlanUpdateWeek[];
}

export function buildPlanUpdatePayload(plan: TrainingPlan): PlanUpdatePayload {
  return {
    id: plan.id,
    name: plan.name,
    ...(plan.description === undefined ? {} : { description: plan.description }),
    weeks: plan.weeks.map((week) => ({
      id: week.id,
      weekNumber: week.weekNumber,
      ...(week.name === undefined ? {} : { name: week.name }),
      days: week.days.map((day) => ({
        id: day.id,
        name: day.name,
        dayType: day.dayType,
        blocks: day.blocks.map((block) => ({
          id: block.id,
          blockType: block.blockType,
          ...(block.rounds === undefined ? {} : { rounds: block.rounds }),
          ...(block.targetTime === undefined ? {} : { targetTime: block.targetTime }),
          exercises: block.exercises.map((exercise) => ({
            ...(exercise.exerciseId === undefined || exercise.exerciseId === ''
              ? {}
              : { exerciseId: exercise.exerciseId }),
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            ...(typeof exercise.weight === 'number' && Number.isFinite(exercise.weight)
              ? { weight: exercise.weight }
              : {})
          }))
        }))
      }))
    }))
  };
}

async function failureReason(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === 'object') {
      const message = (payload as { error?: unknown }).error;
      if (typeof message === 'string' && message.trim() !== '') return message.trim();
    }
  } catch {
    // The body was not JSON; the status line below names the reason then.
  }
  return response.statusText || `status ${response.status}`;
}

/** Saves the whole plan and reports what the server stored. A failure throws with the server's reason. */
export async function saveTrainingPlan(plan: TrainingPlan): Promise<TrainingPlan> {
  const url = `/api/training-plans/${encodeURIComponent(plan.id)}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPlanUpdatePayload(plan))
  });

  if (!response.ok) {
    throw new Error(`PUT ${url} returned ${response.status}: ${await failureReason(response)}`);
  }

  const saved = normalizePlan(await response.json()) ?? plan;

  if (cache?.data) {
    cache = { data: cache.data.map((entry) => (entry.id === saved.id ? saved : entry)) };
    notify();
  }

  return saved;
}

/** A block is added as a standard block; the day type is set separately. */
export function addBlock(day: PlanDay): PlanDay {
  return {
    ...day,
    blocks: [...day.blocks, { id: draftId('block'), blockType: 'Standard', exercises: [] }]
  };
}

export function updateBlock(
  day: PlanDay,
  blockIndex: number,
  update: (block: PlanBlock) => PlanBlock
): PlanDay {
  const block = day.blocks[blockIndex];
  if (!block) return day;

  const blocks = [...day.blocks];
  blocks[blockIndex] = update(block);
  return { ...day, blocks };
}

export function setDayType(day: PlanDay, dayType: DayType): PlanDay {
  return { ...day, dayType };
}

export interface ExerciseValues {
  sets?: number;
  reps?: number;
  weight?: number;
}

/**
 * Adds one catalogue entry. The id and the name snapshot both come from the entry; there is no path
 * here that takes a typed name, so the plan cannot store an exercise the catalogue does not have.
 */
export function addExercise(
  block: PlanBlock,
  entry: CatalogueEntry,
  values?: ExerciseValues
): PlanBlock {
  const exercise: PlanExercise = {
    id: draftId('exercise'),
    exerciseId: entry.id,
    name: entry.name,
    sets: values?.sets ?? 3,
    reps: values?.reps ?? 10,
    ...(values?.weight === undefined ? {} : { weight: values.weight })
  };

  return { ...block, exercises: [...block.exercises, exercise] };
}

export type ExercisePatch = Partial<Pick<PlanExercise, 'sets' | 'reps' | 'weight'>>;

export function updateExercise(
  block: PlanBlock,
  exerciseIndex: number,
  patch: ExercisePatch
): PlanBlock {
  const exercise = block.exercises[exerciseIndex];
  if (!exercise) return block;

  const exercises = [...block.exercises];
  exercises[exerciseIndex] = { ...exercise, ...patch };
  return { ...block, exercises };
}

export function removeExercise(block: PlanBlock, exerciseIndex: number): PlanBlock {
  if (!block.exercises[exerciseIndex]) return block;

  return {
    ...block,
    exercises: block.exercises.filter((_, index) => index !== exerciseIndex)
  };
}

/** Rebuilds one day of one week. An out-of-range index leaves the plan untouched. */
export function updatePlanDay(
  plan: TrainingPlan,
  weekIndex: number,
  dayIndex: number,
  update: (day: PlanDay) => PlanDay
): TrainingPlan {
  const week = plan.weeks[weekIndex];
  const day = week?.days[dayIndex];
  if (!week || !day) return plan;

  const days = [...week.days];
  days[dayIndex] = update(day);

  const weeks = [...plan.weeks];
  weeks[weekIndex] = { ...week, days };
  return { ...plan, weeks };
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
