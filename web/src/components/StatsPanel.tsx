import { useState } from 'react';
import { formatWeekRange } from '../lib/format';
import {
  PERIODS,
  PERIOD_LABELS,
  initialPeriod,
  rememberPeriod,
  useStats,
  type Period,
  type StatsExercise
} from '../lib/stats';

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** The weight of one exercise: the heaviest set, then the last set of the latest session. */
function weightLabel(row: StatsExercise): string {
  if (row.bodyweight) return 'bw';

  const top = row.top_weight;
  const last = row.last_weight;
  if (top === null && last === null) return '—';
  if (top === null) return `${formatNumber(last as number)} kg`;
  if (last === null || top === last) return `${formatNumber(top)} kg`;
  return `${formatNumber(top)} / ${formatNumber(last)} kg`;
}

interface StatsPanelProps {
  userId: string;
}

/**
 * What the journal adds up to over one window: sets, reps, and the weight of every exercise.
 *
 * Ilja, 2026-11-22: the five periods are his, the default is the month, and the choice survives a
 * closed app. A period is a rolling window that ends today — a calendar month would read zero on its
 * first day.
 */
export function StatsPanel({ userId }: StatsPanelProps) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const stats = useStats(userId, period);

  const choose = (next: Period) => {
    setPeriod(next);
    rememberPeriod(next);
  };

  const range = stats.data ? formatWeekRange(stats.data.from, stats.data.to) : null;

  return (
    <div className="arc-panel">
      <div className="arc-panel__head">
        <p className="arc-section-label">Statistics</p>
        {range ? <span className="arc-small arc-muted">{range}</span> : null}
      </div>

      <div className="arc-tabs" role="tablist" aria-label="Statistics period">
        {PERIODS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={name === period}
            className="arc-tabs__tab"
            onClick={() => choose(name)}
          >
            {PERIOD_LABELS[name]}
          </button>
        ))}
      </div>

      {stats.error ? (
        <>
          <p className="arc-empty__text">{stats.error.message}</p>
          <button type="button" className="arc-btn arc-btn--secondary" onClick={stats.reload}>
            Try again
          </button>
        </>
      ) : !stats.data ? (
        <>
          <span className="arc-skeleton" style={{ '--arc-skeleton-width': '60%' } as React.CSSProperties} />
          <span className="arc-skeleton" style={{ '--arc-skeleton-width': '40%' } as React.CSSProperties} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="arc-readout">
              <span className="arc-readout__label">Sets</span>
              <span className="arc-readout__value">{formatNumber(stats.data.sets)}</span>
            </div>
            <div className="arc-readout">
              <span className="arc-readout__label">Reps</span>
              <span className="arc-readout__value">{formatNumber(stats.data.reps)}</span>
            </div>
          </div>

          <p className="arc-small arc-muted">
            {`${stats.data.sessions} ${stats.data.sessions === 1 ? 'session' : 'sessions'} · weight is the heaviest set, then the last`}
          </p>

          {stats.data.exercises.length === 0 ? (
            <p className="arc-empty__text">No set is recorded in this period.</p>
          ) : (
            stats.data.exercises.map((row) => (
              <div className="arc-item arc-item--wrap" key={row.name}>
                <span className="arc-item__text">
                  <span className="arc-item__title">{row.name}</span>
                  <span className="arc-item__meta">{`${formatNumber(row.sets)} sets · ${formatNumber(row.reps)} reps`}</span>
                </span>
                <span className="arc-item__end">
                  <span className="arc-kv__value">{weightLabel(row)}</span>
                </span>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
