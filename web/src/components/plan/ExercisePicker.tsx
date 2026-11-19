import { useMemo, useState } from 'react';
import type { CatalogueEntry } from '../../lib/catalogue';
import { cn } from '../../lib/utils';

interface ExercisePickerProps {
  entries: CatalogueEntry[];
  /** Every chosen id. The plan editor adds one at a time; a workout takes several. */
  selectedIds: string[];
  onToggle: (exerciseId: string) => void;
  className?: string;
}

function matches(entry: CatalogueEntry, query: string): boolean {
  if (query === '') return true;
  const haystack = [entry.name, entry.equipment, ...entry.primary, ...entry.secondary]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

/**
 * One flat list, one row per exercise: an exercise that trains two muscle groups is still one
 * exercise. Grouping by a primary group listed Chin-ups under back and again under biceps.
 */
export function ExercisePicker({ entries, selectedIds, onToggle, className }: ExercisePickerProps) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();

  const shown = useMemo(
    () => entries.filter((entry) => matches(entry, needle)).sort((a, b) => a.name.localeCompare(b.name)),
    [entries, needle]
  );

  return (
    <div className={cn('space-y-3', className)}>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Exercise</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search exercises"
          className="w-full rounded-control border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {selectedIds.length === 0 ? 'Nothing chosen yet' : `${selectedIds.length} chosen`}
        {` · ${shown.length} of ${entries.length}`}
      </p>

      {shown.length === 0 ? (
        <p className="rounded-card border border-border bg-card px-3 py-6 text-center text-sm text-muted-foreground">
          {needle === '' ? 'The catalogue is empty.' : `No exercise matches “${query.trim()}”.`}
        </p>
      ) : (
        <ul className="max-h-[46vh] space-y-1 overflow-y-auto pr-1">
          {shown.map((entry) => {
            const chosen = selectedIds.includes(entry.id);
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => onToggle(entry.id)}
                  aria-pressed={chosen}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-control border px-3 py-2 text-left text-sm transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    chosen
                      ? 'border-primary bg-accent text-accent-foreground'
                      : 'border-border bg-background text-foreground hover:bg-accent'
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{entry.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[entry.equipment, entry.role === 'base' ? 'base' : '', entry.power ? 'power' : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-pill border px-2 py-0.5 text-xs font-semibold',
                      chosen
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground'
                    )}
                  >
                    {chosen ? 'chosen' : 'add'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
