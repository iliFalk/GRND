export type GroupStatus = 'below' | 'in' | 'above' | 'high' | 'unknown';

export interface TargetBand {
  min?: number;
  target_low?: number;
  target_high?: number;
  max?: number;
}

export interface SuggestionExercise {
  name: string;
  equipment?: string;
  primary?: string[];
  secondary?: string[];
}

export interface SuggestionGroup {
  group: string;
  sets: number;
  short?: number;
  target?: TargetBand;
  status?: string;
  suggestions: SuggestionExercise[];
}

export interface SuggestionsResponse {
  week_start?: string;
  week_end?: string;
  sessions?: number;
  groups?: SuggestionGroup[];
  unmapped?: Array<{ name: string; sets: number }>;
}

export interface VolumeGroup {
  group: string;
  sets: number;
  target?: TargetBand;
  status?: string;
}

export interface VolumeResponse {
  week_start?: string;
  week_end?: string;
  sessions?: number;
  groups?: VolumeGroup[];
}

export interface DashboardGroup extends SuggestionGroup {
  short: number;
  target: TargetBand;
  status: GroupStatus;
  suggestions: SuggestionExercise[];
}

export interface DashboardData {
  week_start: string | null;
  week_end: string | null;
  sessions: number;
  groups: DashboardGroup[];
  unmapped: Array<{ name: string; sets: number }>;
}

export interface DashboardState {
  data?: DashboardData;
  error?: Error;
  loading: boolean;
}

interface CacheEntry {
  data?: DashboardData;
  error?: Error;
  promise?: Promise<DashboardData>;
}

const cache = new Map<string, CacheEntry>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeDashboard(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDashboardState(userId: string): DashboardState {
  const entry = cache.get(userId);
  if (entry?.data) return { data: entry.data, loading: false };
  if (entry?.error) return { error: entry.error, loading: false };
  return { loading: true };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return (await response.json()) as T;
}

const STATUSES: readonly GroupStatus[] = ['below', 'in', 'above', 'high', 'unknown'];

function normalizeStatus(value: unknown): GroupStatus {
  return STATUSES.includes(value as GroupStatus) ? (value as GroupStatus) : 'below';
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function merge(suggestions: SuggestionsResponse, volume: VolumeResponse | null): DashboardData {
  const details = new Map<string, VolumeGroup>();
  for (const group of volume?.groups ?? []) {
    if (group && typeof group.group === 'string') details.set(group.group, group);
  }

  const groups: DashboardGroup[] = (suggestions.groups ?? [])
    .filter((group) => group && typeof group.group === 'string')
    .map((group) => {
      const detail = details.get(group.group);
      const target = group.target ?? detail?.target ?? {};
      const sets = numberOr(group.sets, 0);
      const short =
        group.short === undefined
          ? typeof target.min === 'number'
            ? Math.max(0, Math.round((target.min - sets) * 10) / 10)
            : 0
          : numberOr(group.short, 0);

      return {
        ...group,
        sets,
        short,
        target,
        status: normalizeStatus(group.status ?? detail?.status),
        suggestions: Array.isArray(group.suggestions) ? group.suggestions : []
      };
    });

  return {
    week_start: suggestions.week_start ?? volume?.week_start ?? null,
    week_end: suggestions.week_end ?? volume?.week_end ?? null,
    sessions: numberOr(suggestions.sessions ?? volume?.sessions, 0),
    groups,
    unmapped: Array.isArray(suggestions.unmapped) ? suggestions.unmapped : []
  };
}

/** Drops the cached week, so the next read asks the server again. */
export function invalidateDashboard(userId: string): void {
  cache.delete(userId);
  notify();
}

/**
 * The suggestions route names the short groups. The volume route carries the target band and the
 * status those groups were measured against, so a card can draw its bar and colour.
 */
export function loadDashboardData(userId: string): Promise<DashboardData> {
  const existing = cache.get(userId);
  if (existing?.data) return Promise.resolve(existing.data);
  if (existing?.promise) return existing.promise;

  const id = encodeURIComponent(userId);
  const promise = Promise.all([
    fetchJson<SuggestionsResponse>(`/api/suggestions/${id}`),
    fetchJson<VolumeResponse>(`/api/muscle-volume/${id}`).catch(() => null)
  ])
    .then(([suggestions, volume]) => {
      const data = merge(suggestions, volume);
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
