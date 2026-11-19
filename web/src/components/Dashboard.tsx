import { useExerciseCatalogue, type CatalogueEntry } from '../lib/catalogue';
import type { PillarRow, PillarStatus, PillarsData } from '../lib/pillars';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';

const STATUS_COLOR: Record<PillarStatus, string> = {
  below: 'var(--status-below)',
  in: 'var(--status-in)',
  above: 'var(--status-above)',
  high: 'var(--status-high)',
  unknown: 'var(--muted-foreground)'
};

const STATUS_LABEL: Record<PillarStatus, string> = {
  below: 'Below',
  in: 'In band',
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

function PillarTile({ row }: { row: PillarRow }) {
  const colour = STATUS_COLOR[row.status];
  const max =
    typeof row.target.max === 'number' && row.target.max > 0
      ? row.target.max
      : row.sets + row.short;
  const percent = max > 0 ? Math.min(100, (row.sets / max) * 100) : 0;

  return (
    <Card>
      <CardContent className="space-y-2 px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {row.label}
        </p>
        <p className="font-mono text-2xl leading-none tabular-nums">{formatNumber(row.sets)}</p>
        <p className="text-[11px] text-muted-foreground">{`of ${formatNumber(max)} sets`}</p>
        <Progress
          value={percent}
          indicatorStyle={{ backgroundColor: colour }}
          aria-label={`${row.label}: ${formatNumber(row.sets)} of ${formatNumber(max)} sets`}
        />
        <p className="text-[11px] font-semibold" style={{ color: colour }}>
          {row.status === 'below' ? `${formatNumber(row.short)} short` : STATUS_LABEL[row.status]}
        </p>
        {row.base_sets > 0 || row.power_sets > 0 ? (
          <p className="text-[11px] text-muted-foreground">
            {[
              row.base_sets > 0 ? `base ${formatNumber(row.base_sets)}` : '',
              row.power_sets > 0 ? `power ${formatNumber(row.power_sets)}` : ''
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : null}
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
          {short.length === 0 ? 'all in band' : `${short.length} to close`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {data.pillars.map((row) => (
          <PillarTile key={row.id} row={row} />
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{short.length === 0 ? 'Nothing is short' : 'What to add'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {short.length === 0 ? (
            <p className="text-muted-foreground">Every pillar is inside its band.</p>
          ) : (
            short.map((row) => {
              // The base first: it is what the pillar rests on.
              const names = candidatesFor(entries, row.movements, 4);
              return (
                <div key={row.id} className="flex items-baseline justify-between gap-3">
                  <span className="shrink-0 font-medium">{row.label}</span>
                  <span className="min-w-0 truncate text-right text-xs text-muted-foreground">
                    {names.length > 0 ? names.join(' · ') : 'nothing at home closes this'}
                  </span>
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
