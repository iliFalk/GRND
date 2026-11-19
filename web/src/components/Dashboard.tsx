import { useExerciseCatalogue, type CatalogueEntry } from '../lib/catalogue';
import type { PillarRow, PillarStatus, PillarsData } from '../lib/pillars';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const STATUS_COLOR: Record<PillarStatus, string> = {
  below: 'var(--status-below)',
  in: 'var(--status-in)',
  above: 'var(--status-above)',
  high: 'var(--status-high)',
  unknown: 'var(--muted-foreground)'
};

const STATUS_LABEL: Record<PillarStatus, string> = {
  below: 'Short',
  in: 'OK',
  above: 'Above',
  high: 'High',
  unknown: 'Unknown'
};

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

/**
 * A ring of progress toward the floor of the pillar: a quarter at one set, full at four. The number
 * inside is what the week has done.
 */
function PillarRing({ row }: { row: PillarRow }) {
  const colour = STATUS_COLOR[row.status];
  const floor = typeof row.target.min === 'number' ? row.target.min : 0;
  const percent = floor > 0 ? Math.min(100, (row.sets / floor) * 100) : 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-14 w-14">
        <svg viewBox="0 0 36 36" className="h-14 w-14" role="img"
          aria-label={`${row.label}: ${formatNumber(row.sets)} sets this week, ${formatNumber(floor)} needed`}
        >
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--muted)" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke={colour}
            strokeWidth="3"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${percent} 100`}
            transform="rotate(-90 18 18)"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-mono text-lg font-semibold tabular-nums">
          {formatNumber(row.sets)}
        </span>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {row.label}
      </span>
      <span className="text-[10px] font-semibold" style={{ color: colour }}>
        {row.status === 'below' ? `${formatNumber(row.short)} more` : STATUS_LABEL[row.status]}
      </span>
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
            <PillarRing key={row.id} row={row} />
          ))}
        </CardContent>
      </Card>

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
