import { useExerciseCatalogue, type CatalogueEntry } from '../lib/catalogue';
import type { DayRow, PillarRow, PillarsData } from '../lib/pillars';
import { PillarRing, pillarColor } from './PillarRing';

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** What closes a pillar at home: the catalogue's movements are the pillar's own list. */
function candidatesFor(entries: CatalogueEntry[], movements: string[], limit = 3): string[] {
  const wanted = movements.map((movement) => movement.toLowerCase());
  return entries
    .filter((entry) => entry.excluded !== true)
    .filter((entry) => wanted.includes(String(entry.movement ?? '').toLowerCase()))
    // The base first: it is what the pillar rests on, the rest completes it.
    .sort((a, b) => {
      const baseA = a.role === 'base' ? 0 : 1;
      const baseB = b.role === 'base' ? 0 : 1;
      return baseA - baseB || a.name.localeCompare(b.name);
    })
    .map((entry) => entry.name)
    .slice(0, limit);
}

/** The week by day: what each day carried, today in the accent colour. */
function WeekBars({ days, pillars }: { days: DayRow[]; pillars: PillarRow[] }) {
  const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  // The scale holds at the floor, so a quiet week does not read as a busy one.
  const max = Math.max(4, ...days.map((day) => day.sets));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="arc-panel">
      <div className="flex items-end gap-1">
        {days.map((day, index) => {
          const isToday = day.date === today;

          return (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {day.sets > 0 ? day.sets : ''}
              </span>
              <div className="flex h-16 w-full flex-col justify-end overflow-hidden">
                {pillars.map((pillar) => {
                  const sets = day.pillars[pillar.id] ?? 0;
                  if (sets <= 0) return null;
                  return (
                    <div
                      key={pillar.id}
                      className="w-full"
                      style={{
                        height: `${(sets / max) * 100}%`,
                        backgroundColor: pillarColor(pillar.id),
                        opacity: isToday ? 1 : 0.75
                      }}
                      title={`${pillar.label}: ${formatNumber(sets)}`}
                    />
                  );
                })}
                {day.sets === 0 ? (
                  <div className="w-full bg-muted-foreground/20" style={{ height: '2%' }} />
                ) : null}
              </div>
              <span
                className={
                  isToday
                    ? 'text-[10px] font-semibold text-primary'
                    : 'text-[10px] text-muted-foreground'
                }
              >
                {letters[index]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DashboardProps {
  data?: PillarsData;
  loading: boolean;
  error?: Error;
  onRetry: () => void;
}

export function Dashboard({ data, loading, error, onRetry }: DashboardProps) {
  const catalogue = useExerciseCatalogue();

  if (error) {
    return (
      <div className="arc-panel">
        <div className="arc-empty">
          <p className="arc-h3">The week could not be loaded</p>
          <p className="arc-empty__text">{error.message}</p>
        </div>
        <button type="button" className="arc-btn arc-btn--secondary" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  if (!data || loading) {
    return (
      <div className="arc-panel">
        <span className="arc-skeleton" style={{ '--arc-skeleton-width': '70%' } as React.CSSProperties} />
        <span className="arc-skeleton" style={{ '--arc-skeleton-width': '45%' } as React.CSSProperties} />
        <span className="arc-skeleton" style={{ '--arc-skeleton-width': '60%' } as React.CSSProperties} />
      </div>
    );
  }

  const entries = catalogue.data ?? [];
  const short = data.pillars.filter((row) => row.status === 'below');
  const circuits = data.circuit_rounds;

  return (
    <section aria-labelledby="week-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="arc-section-label" id="week-title">
          This week
        </p>
        <span className={short.length === 0 ? 'arc-chip arc-chip--ok' : 'arc-chip arc-chip--attention'}>
          <i className="arc-chip__dot" />
          {short.length === 0 ? 'All done' : `${short.length} short`}
        </span>
      </div>
      <p className="arc-small arc-muted">
        {`${data.sessions} ${data.sessions === 1 ? 'session' : 'sessions'} · four sets close a pillar`}
      </p>

      <div className="arc-panel">
        <div className="grid grid-cols-4 gap-1">
          {data.pillars.map((row) => (
            <PillarRing
              key={row.id}
              id={row.id}
              label={row.label}
              sets={row.sets}
              floor={typeof row.target.min === 'number' ? row.target.min : 0}
            />
          ))}
        </div>
      </div>

      {data.days.length > 0 ? <WeekBars days={data.days} pillars={data.pillars} /> : null}

      <div className="arc-panel arc-panel--flat">
        <p className="arc-section-label">{short.length === 0 ? 'Nothing is short' : 'What to add'}</p>
        {short.length === 0 ? (
          <p className="arc-empty__text">Every pillar has its four sets.</p>
        ) : (
          short.map((row) => {
            // The base first: it is what the pillar rests on.
            const names = candidatesFor(entries, row.movements, 4);
            // A stack of its own, not a list row: the candidates wrap to as many lines as they need, and an
            // item row owes its neighbours one height.
            return (
              <div key={row.id}>
                <p className="arc-label">{row.label}</p>
                <p className="arc-small arc-muted">
                  {names.length > 0 ? names.join(' · ') : 'nothing at home closes this'}
                </p>
              </div>
            );
          })
        )}
      </div>

      {circuits > 0 ? (
        <div className="arc-panel">
          <p className="arc-section-label">Circuit work</p>
          <div className="arc-row">
            <span className="arc-kv__key">Rounds</span>
            <span className="arc-kv__value">{formatNumber(circuits)}</span>
          </div>
          <div className="arc-row">
            <span className="arc-kv__key">Under load</span>
            <span className="arc-kv__value">
              {formatClock(data.circuits.reduce((sum, circuit) => sum + circuit.time_under_load, 0))}
            </span>
          </div>
          <p className="arc-small arc-muted">A circuit is endurance work: it moves no pillar.</p>
        </div>
      ) : null}

      {data.outside.length > 0 ? (
        <p className="arc-small arc-muted">
          {`Outside the pillars: ${data.outside
            .map((entry) => `${entry.name} ${formatNumber(entry.sets)}`)
            .join(', ')}`}
        </p>
      ) : null}
    </section>
  );
}
