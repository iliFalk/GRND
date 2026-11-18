import type { DashboardData, DashboardGroup, GroupStatus } from '../lib/suggestions';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';

const STATUS_COLOR: Record<GroupStatus, string> = {
  below: 'var(--status-below)',
  in: 'var(--status-in)',
  above: 'var(--status-above)',
  high: 'var(--status-high)',
  unknown: 'var(--muted-foreground)'
};

const STATUS_LABEL: Record<GroupStatus, string> = {
  below: 'Below',
  in: 'In band',
  above: 'Above',
  high: 'High',
  unknown: 'Unknown'
};

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function GroupCard({ group }: { group: DashboardGroup }) {
  const color = STATUS_COLOR[group.status];
  const max =
    typeof group.target.max === 'number' && group.target.max > 0
      ? group.target.max
      : group.sets + group.short;
  const percent = max > 0 ? (group.sets / max) * 100 : 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-2">
        <CardTitle className="capitalize">{group.group}</CardTitle>
        <span className="shrink-0 text-xs font-semibold" style={{ color }}>
          {STATUS_LABEL[group.status]}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold tabular-nums">
            {`${formatNumber(group.sets)} / ${formatNumber(max)} sets`}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatNumber(group.short)} short
          </span>
        </div>
        <Progress
          value={percent}
          indicatorStyle={{ backgroundColor: color }}
          aria-label={`${group.group}: ${formatNumber(group.sets)} of ${formatNumber(max)} sets`}
        />
        <div className="flex flex-wrap gap-1.5">
          {group.suggestions.length > 0 ? (
            group.suggestions.map((suggestion) => (
              <Badge key={suggestion.name} title={suggestion.equipment}>
                {suggestion.name}
              </Badge>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">nothing at home closes this</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface DashboardProps {
  data?: DashboardData;
  loading: boolean;
  error?: Error;
  onRetry: () => void;
}

export function Dashboard({ data, loading, error, onRetry }: DashboardProps) {
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

  if (data.groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm font-medium">Nothing is short this week.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Every muscle group has reached its band.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section aria-labelledby="short-groups-title" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="short-groups-title" className="text-lg font-semibold">
            Short groups
          </h2>
          <p className="text-xs text-muted-foreground">
            What to add this week · {data.sessions} {data.sessions === 1 ? 'session' : 'sessions'}
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {data.groups.length} to close
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.groups.map((group) => (
          <GroupCard key={group.group} group={group} />
        ))}
      </div>
    </section>
  );
}
