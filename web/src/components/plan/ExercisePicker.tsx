import { useMemo, useState } from 'react';
import type { CatalogueEntry } from '../../lib/catalogue';
import { cn } from '../../lib/utils';

interface ExercisePickerProps {
  entries: CatalogueEntry[];
  selectedId?: string | null;
  onSelect: (exerciseId: string) => void;
  className?: string;
}

interface MuscleGroup {
  muscle: string;
  entries: CatalogueEntry[];
}

function groupByPrimary(entries: CatalogueEntry[]): MuscleGroup[] {
  const groups = new Map<string, CatalogueEntry[]>();

  for (const entry of entries) {
    const muscles = entry.primary.length > 0 ? entry.primary : ['other'];
    for (const raw of muscles) {
      const muscle = raw.trim().toLowerCase() || 'other';
      const group = groups.get(muscle);
      if (group) group.push(entry);
      else groups.set(muscle, [entry]);
    }
  }

  return [...groups.entries()]
    .map(([muscle, group]) => ({
      muscle,
      entries: [...group].sort((a, b) => a.name.localeCompare(b.name))
    }))
    .sort((a, b) => a.muscle.localeCompare(b.muscle));
}

function matches(entry: CatalogueEntry, query: string): boolean {
  if (query === '') return true;
  const haystack = [entry.name, entry.equipment, ...entry.primary, ...entry.secondary]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

/** Picks one catalogue entry. The selection is the entry's stable id; the name is only what is read. */
export function ExercisePicker({
  entries,
  selectedId,
  onSelect,
  className
}: ExercisePickerProps) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();

  const groups = useMemo(
    () => groupByPrimary(entries.filter((entry) => matches(entry, needle))),
    [entries, needle]
  );

  const selected = entries.find((entry) => entry.id === selectedId);

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
        {selected ? (
          <>
            Selected: <span className="font-medium text-foreground">{selected.name}</span>
          </>
        ) : (
          'No exercise selected'
        )}
      </p>

      {groups.length === 0 ? (
        <p className="rounded-card border border-border bg-card px-3 py-6 text-center text-sm text-muted-foreground">
          {needle === '' ? 'The catalogue is empty.' : `No exercise matches “${query.trim()}”.`}
        </p>
      ) : (
        <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
          {groups.map((group) => (
            <div key={group.muscle} role="group" aria-label={`${group.muscle} exercises`}>
              <div className="flex items-center justify-between gap-2 px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.muscle}
                </h3>
                <span className="text-xs text-muted-foreground">{group.entries.length}</span>
              </div>
              <ul className="mt-1 space-y-1">
                {group.entries.map((entry) => {
                  const isSelected = entry.id === selectedId;
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(entry.id)}
                        aria-pressed={isSelected}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-control border px-3 py-2 text-left text-sm transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isSelected
                            ? 'border-primary bg-accent text-accent-foreground'
                            : 'border-border bg-background text-foreground hover:bg-accent'
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{entry.name}</span>
                          {entry.equipment ? (
                            <span className="block text-xs text-muted-foreground">
                              {entry.equipment}
                            </span>
                          ) : null}
                        </span>
                        {isSelected ? (
                          <span className="shrink-0 text-xs font-semibold text-primary">selected</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
