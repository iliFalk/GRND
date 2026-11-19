import { useExerciseCatalogue, type CatalogueEntry } from '../lib/catalogue';
import type { DayRow, PillarsData } from '../lib/pillars';
import { PillarRing } from './PillarRing';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

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
function WeekBars({ days }: { days: DayRow[] }) {
  const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  // The scale holds at the floor, so a quiet week does not read as a busy one.
  const max = Math.max(4, ...days.map((day) => day.sets));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardContent className="flex items-end gap-1 px-2 pb-2 pt-3">
        {days.map((day, index) => {
          const isToday = day.date === today;
          const height = Math.round((day.sets / max) * 100);

          return (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {day.sets > 0 ? day.sets : ''}
              </span>
              <div className="flex h-16 w-full items-end">
                <div
                  className={isToday ? 'w-full rounded-t bg-primary' : 'w-full rounded-t bg-muted-foreground/30'}
                  style={{ height: `${Math.max(day.sets > 0 ? 8 : 2, height)}%` }}
                />
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
      </CardContent>
    </Card>
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
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <p className="text-sm font-medium">The week could not be loaded.</p>
          <p className="text-xs text-muted-foreground">{error.message}</p>
          <Button size="sm" onClick={onRetry}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data || loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading your week…
        </CardContent>
      </Card>
    );
  }

  const entries = catalogue.data ?? [];
  const short = data.pillars.filter((row) => row.status === 'below');
  const circuits = data.circuit_rounds;

  return (
    <section aria-labelledby="week-title" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="week-title" className="text-lg font-semibold">
            This week
          </h2>
          <p className="text-xs text-muted-foreground">
            {`${data.sessions} ${data.sessions === 1 ? 'session' : 'sessions'}`}
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {short.length === 0 ? 'all done' : `${short.length} short`}
        </span>
      </div>

      <Card>
        <CardContent className="grid grid-cols-4 gap-1 px-2 py-3">
          {data.pillars.map((row) => (
            <PillarRing
              key={row.id}
              label={row.label}
              sets={row.sets}
              floor={typeof row.target.min === 'number' ? row.target.min : 0}
            />
          ))}
        </CardContent>
      </Card>

      {data.days.length > 0 ? <WeekBars days={data.days} /> : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{short.length === 0 ? 'Nothing is short' : 'What to add'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {short.length === 0 ? (
            <p className="text-muted-foreground">Every pillar has its four sets.</p>
          ) : (
            short.map((row) => {
              // The base first: it is what the pillar rests on.
              const names = candidatesFor(entries, row.movements, 4);
              return (
                <div key={row.id} className="space-y-0.5">
                  <p className="text-sm font-semibold">{row.label}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {names.length > 0 ? names.join(' · ') : 'nothing at home closes this'}
                  </p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {circuits > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Circuit work</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {`${formatNumber(circuits)} rounds · ${formatClock(
              data.circuits.reduce((sum, circuit) => sum + circuit.time_under_load, 0)
            )} under load · outside the pillars`}
          </CardContent>
        </Card>
      ) : null}

      {data.outside.length > 0 ? (
        <p className="px-1 text-xs text-muted-foreground">
          {`Outside the pillars: ${data.outside
            .map((entry) => `${entry.name} ${formatNumber(entry.sets)}`)
            .join(', ')}`}
        </p>
      ) : null}
    </section>
  );
}
