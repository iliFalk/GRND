import { useCallback, useEffect, useState } from 'react';

/** One entry of `data/exercise-catalogue.json` as the route returns it. */
export interface CatalogueEntry {
  id: string;
  name: string;
  equipment: string;
  primary: string[];
  secondary: string[];
  /** The axis the pillar report counts by: pull, push, squat, hinge, core, carry, power, conditioning. */
  movement?: string;
  /** The base of its pillar, or what completes it. */
  role?: 'base' | 'support';
  /** Ballistic work: a jump, the swing, a snatch. */
  power?: boolean;
  /** May be used in an AMRAP circuit. */
  is_circuit?: boolean;
  /** Stays pickable but is not counted in its pillar. */
  excluded?: boolean;
  /** Only the AMRAP list shows it; the Sets list never does. */
  amrap_only?: boolean;
  bodyweight_factor?: number;
}

export interface CatalogueState {
  data?: CatalogueEntry[];
  error?: Error;
  loading: boolean;
}

export interface CatalogueQuery extends CatalogueState {
  reload: () => void;
}

interface CacheEntry {
  data?: CatalogueEntry[];
  error?: Error;
  promise?: Promise<CatalogueEntry[]>;
}

/** The catalogue is the same for every user, so one request is cached for the whole app. */
let cache: CacheEntry | undefined;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeCatalogue(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCatalogueState(): CatalogueState {
  if (cache?.data) return { data: cache.data, loading: false };
  if (cache?.error) return { error: cache.error, loading: false };
  return { loading: true };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function normalizeEntry(raw: unknown): CatalogueEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (!id || !name) return null;

  const factor = record.bodyweight_factor;
  const movement = typeof record.movement === 'string' ? record.movement.trim() : '';
  return {
    id,
    name,
    equipment: typeof record.equipment === 'string' ? record.equipment : '',
    primary: stringList(record.primary),
    secondary: stringList(record.secondary),
    ...(movement === '' ? {} : { movement }),
    ...(record.role === 'base' || record.role === 'support' ? { role: record.role } : {}),
    ...(record.power === true ? { power: true } : {}),
    ...(record.is_circuit === true ? { is_circuit: true } : {}),
    ...(record.excluded === true ? { excluded: true } : {}),
    ...(record.amrap_only === true ? { amrap_only: true } : {}),
    ...(typeof factor === 'number' && Number.isFinite(factor)
      ? { bodyweight_factor: factor }
      : {})
  };
}

function normalizeCatalogue(payload: unknown): CatalogueEntry[] {
  const list = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === 'object' &&
        Array.isArray((payload as { exercises?: unknown }).exercises)
      ? (payload as { exercises: unknown[] }).exercises
      : [];

  return list
    .map(normalizeEntry)
    .filter((entry): entry is CatalogueEntry => entry !== null);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return (await response.json()) as T;
}

export function loadExerciseCatalogue(): Promise<CatalogueEntry[]> {
  if (cache?.data) return Promise.resolve(cache.data);
  if (cache?.promise) return cache.promise;

  const promise = fetchJson<unknown>('/api/exercise-catalogue')
    .then((payload) => {
      const data = normalizeCatalogue(payload);
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

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * A plan written before the catalogue carries only a name. This finds the catalogue entry for it so
 * the view can show which id it would be saved as; it never makes an id up.
 */
/** What the Sets mode offers: every exercise except the ones kept for AMRAP alone. */
export function setsEntries(entries: CatalogueEntry[]): CatalogueEntry[] {
  return entries.filter((entry) => entry.amrap_only !== true);
}

/** What a circuit may use. */
export function amrapEntries(entries: CatalogueEntry[]): CatalogueEntry[] {
  return entries.filter((entry) => entry.is_circuit === true);
}

export function resolveCatalogueEntryByName(
  entries: CatalogueEntry[],
  name: string
): CatalogueEntry | undefined {
  const needle = normalizeName(name);
  if (!needle) return undefined;
  return entries.find((entry) => normalizeName(entry.name) === needle);
}

export function useExerciseCatalogue(): CatalogueQuery {
  const [state, setState] = useState<CatalogueState>(getCatalogueState);

  useEffect(() => {
    let active = true;
    const sync = () => {
      if (active) setState(getCatalogueState());
    };

    const unsubscribe = subscribeCatalogue(sync);
    sync();
    void loadExerciseCatalogue().catch(() => {
      // The state carries the error; a catalogue miss only hides the legacy resolution.
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const reload = useCallback(() => {
    void loadExerciseCatalogue().catch(() => {
      // The state carries the error; a catalogue miss only hides the legacy resolution.
    });
  }, []);

  return { ...state, reload };
}
