import { useState } from 'react';
import { useExerciseCatalogue } from '../../lib/catalogue';
import {
  formatDuration,
  formatSessionDate,
  mainExercise,
  sessionSets,
  setSummary,
  tonne,
  useHistory,
  type HistorySession
} from '../../lib/history';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface HistoryScreenProps {
  userId: string;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function rowLine(session: HistorySession): string {
  return [
    `${formatNumber(sessionSets(session))} sets`,
    `${formatNumber(tonne(session))} kg`,
    formatDuration(session.duration),
    `rest ${formatDuration(session.rest_seconds)}`
  ].join(' · ');
}

export function HistoryScreen({ userId }: HistoryScreenProps) {
  const history = useHistory(userId);
  const catalogue = useExerciseCatalogue();
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const baseIds = (catalogue.data ?? [])
    .filter((entry) => entry.role === 'base')
    .map((entry) => entry.id);

  const open = openId ? history.sessions.find((session) => session.id === openId) ?? null : null;

  if (history.error) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <p className="text-sm font-medium">The history could not be loaded.</p>
          <p className="text-xs text-muted-foreground">{history.error}</p>
          <Button size="sm" onClick={() => void history.reload()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (history.loading && history.sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading the sessions…
        </CardContent>
      </Card>
    );
  }

  if (history.sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm font-medium">No sessions yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">A finished workout lands here.</p>
        </CardContent>
      </Card>
    );
  }

  if (open) {
    return (
      <section className="space-y-3">
        <button
          type="button"
          onClick={() => {
            setOpenId(null);
            setConfirmId(null);
          }}
          className="rounded-control px-1 py-1 text-sm font-medium text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← All sessions
        </button>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{formatSessionDate(open.date)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="text-muted-foreground">{rowLine(open)}</p>
            {open.dayType === 'CIRCUIT' ? (
              <p className="text-xs text-muted-foreground">Circuit · outside the pillars</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="divide-y divide-border py-0">
            {(open.completedExercises ?? []).map((exercise, index) => (
              <div key={`${exercise.name}-${index}`} className="space-y-1 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {exercise.name}
                    {exercise.superset ? (
                      <span className="ml-1.5 rounded-pill border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        superset
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {`${formatNumber(exercise.volume ?? 0)} kg`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{setSummary(exercise)}</p>
              </div>
            ))}
            {(open.completedExercises ?? []).length === 0 ? (
              <p className="py-3 text-xs text-muted-foreground">No exercise was recorded.</p>
            ) : null}
          </CardContent>
        </Card>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <Button
          variant={confirmId === open.id ? 'default' : 'outline'}
          className="w-full"
          onClick={async () => {
            if (confirmId !== open.id) {
              setConfirmId(open.id);
              return;
            }
            try {
              await history.remove(open.id);
              setOpenId(null);
              setConfirmId(null);
              setError(null);
            } catch (cause: unknown) {
              setError(cause instanceof Error ? cause.message : String(cause));
            }
          }}
        >
          {confirmId === open.id ? 'Tap again to delete this session' : 'Delete session'}
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="history-title" className="space-y-3">
      <div>
        <h2 id="history-title" className="text-lg font-semibold">
          History
        </h2>
        <p className="text-xs text-muted-foreground">
          {`${history.sessions.length} ${history.sessions.length === 1 ? 'session' : 'sessions'}`}
        </p>
      </div>

      <ul className="space-y-2">
        {history.sessions.map((session) => (
          <li key={session.id}>
            <button
              type="button"
              onClick={() => setOpenId(session.id)}
              className="w-full space-y-1 rounded-card border border-border bg-card px-3 py-2.5 text-left shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold">{formatSessionDate(session.date)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {`${formatNumber(tonne(session))} kg`}
                </span>
              </span>
              <span className="block truncate text-sm">{mainExercise(session, baseIds)}</span>
              <span className="block text-xs text-muted-foreground">{rowLine(session)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
