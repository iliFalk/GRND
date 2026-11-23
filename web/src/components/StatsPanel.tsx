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

/** `+6`, `-3`, or nothing: no earlier block to compare with, or nothing changed. */
function signed(value: number | null): string {
  if (value === null || value === 0) return '';
  return value > 0 ? `+${formatNumber(value)}` : `-${formatNumber(Math.abs(value))}`;
}

/** The change behind a number: a space and a sign, because a 390-pixel row holds no brackets. */
function behind(value: number | null): string {
  return value === null ? '' : ` ${signed(value)}`;
}

/** A rise is the news of a training block; a fall is not an alarm, so it stays plain grey. */
function deltaClass(value: number | null): string {
  if (value === null || value === 0) return 'arc-small arc-muted';
  return value > 0 ? 'arc-small text-status-in' : 'arc-small arc-muted';
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
 * What the journal adds up to over one block: sets, reps, and the weight of every exercise, each with
 * its difference against the block before.
 *
 * Ilja, 2026-11-22: two blocks — four weeks and four months. A block is a rolling window that ends
 * today, and the block it is measured against is the one before: the same length, ending where this one
 * begins. The chosen block survives a closed app.
 */
export function StatsPanel({ userId }: StatsPanelProps) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const stats = useStats(userId, period);

  const choose = (next: Period) => {
    setPeriod(next);
    rememberPeriod(next);
  };

  const range = stats.data ? formatWeekRange(stats.data.from, stats.data.to) : null;
  const before = stats.data ? formatWeekRange(stats.data.before_from, stats.data.before_to) : null;

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
              <span className={deltaClass(stats.data.delta_sets)}>{signed(stats.data.delta_sets)}</span>
            </div>
            <div className="arc-readout">
              <span className="arc-readout__label">Reps</span>
              <span className="arc-readout__value">{formatNumber(stats.data.reps)}</span>
              <span className={deltaClass(stats.data.delta_reps)}>{signed(stats.data.delta_reps)}</span>
            </div>
          </div>

          <p className="arc-small arc-muted">
            {`${stats.data.sessions} ${stats.data.sessions === 1 ? 'session' : 'sessions'} · change against ${before ?? 'the block before'}`}
          </p>

          {stats.data.exercises.length === 0 ? (
            <p className="arc-empty__text">No set is recorded in this period.</p>
          ) : (
            stats.data.exercises.map((row) => (
              <div className="arc-item arc-item--wrap" key={row.name}>
                <span className="arc-item__text">
                  <span className="arc-item__title">{row.name}</span>
                  <span className="arc-item__meta">
                    {`${formatNumber(row.sets)} sets${behind(row.delta_sets)} · ${formatNumber(row.reps)} reps${behind(row.delta_reps)}`}
                  </span>
                </span>
                <span className="arc-item__end">
                  <span className="arc-kv__value">
                    {`${weightLabel(row)}${row.bodyweight ? '' : behind(row.delta_top_weight)}`}
                  </span>
                </span>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
