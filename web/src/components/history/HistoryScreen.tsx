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

/** One mark, drawn by the shipped sprite: the system draws every icon in one place. */
function Mark({ name, className = 'arc-icon' }: { name: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`/icons.svg#${name}`} />
    </svg>
  );
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
      <section aria-labelledby="history-title">
        <p className="arc-section-label" id="history-title">
          History
        </p>
        <div className="arc-panel">
          <div className="arc-empty">
            <p className="arc-h3">The history could not be loaded</p>
            <p className="arc-empty__text">{history.error}</p>
          </div>
          <button type="button" className="arc-btn arc-btn--secondary" onClick={() => void history.reload()}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  if (history.loading && history.sessions.length === 0) {
    return (
      <section aria-labelledby="history-title">
        <p className="arc-section-label" id="history-title">
          History
        </p>
        <div className="arc-panel">
          <span className="arc-skeleton" style={{ '--arc-skeleton-width': '70%' } as React.CSSProperties} />
          <span className="arc-skeleton" style={{ '--arc-skeleton-width': '45%' } as React.CSSProperties} />
        </div>
      </section>
    );
  }

  if (history.sessions.length === 0) {
    return (
      <section aria-labelledby="history-title">
        <p className="arc-section-label" id="history-title">
          History
        </p>
        <div className="arc-panel">
          <div className="arc-empty">
            <p className="arc-h3">No sessions yet</p>
            <p className="arc-empty__text">A finished workout lands here.</p>
          </div>
        </div>
      </section>
    );
  }

  if (open) {
    const exercises = open.completedExercises ?? [];
    return (
      <section aria-labelledby="history-title">
        <p className="arc-section-label" id="history-title">
          History
        </p>

        <div className="arc-panel">
          <div className="arc-panel__head">
            <h2 className="arc-h3">{formatSessionDate(open.date)}</h2>
            {open.dayType === 'CIRCUIT' ? <span className="arc-chip">Circuit</span> : null}
          </div>
          <p className="arc-small arc-muted">{rowLine(open)}</p>
          <div className="arc-row">
            <span className="arc-kv__key">Sets</span>
            <span className="arc-kv__value">{formatNumber(sessionSets(open))}</span>
          </div>
          <div className="arc-row">
            <span className="arc-kv__key">Tonnage</span>
            <span className="arc-kv__value">{`${formatNumber(tonne(open))} kg`}</span>
          </div>
          <div className="arc-row">
            <span className="arc-kv__key">Duration</span>
            <span className="arc-kv__value">{formatDuration(open.duration)}</span>
          </div>
          <div className="arc-row">
            <span className="arc-kv__key">Rest</span>
            <span className="arc-kv__value">{formatDuration(open.rest_seconds)}</span>
          </div>
          {open.dayType === 'CIRCUIT' ? (
            <p className="arc-small arc-muted">A circuit is endurance work: it moves no pillar.</p>
          ) : null}
        </div>

        <div className="arc-panel arc-panel--flat">
          <p className="arc-section-label">Exercises</p>
          {exercises.map((exercise, index) => (
            <div className="arc-item" key={`${exercise.name}-${index}`}>
              <span className="arc-item__text">
                <span className="arc-item__title">{exercise.name}</span>
                <span className="arc-item__meta">{setSummary(exercise)}</span>
              </span>
              <span className="arc-item__end">
                {exercise.superset ? <span className="arc-chip">Superset</span> : null}
                <span className="arc-kv__value">{`${formatNumber(exercise.volume ?? 0)} kg`}</span>
              </span>
            </div>
          ))}
          {exercises.length === 0 ? <p className="arc-empty__text">No exercise was recorded.</p> : null}
        </div>

        {error ? (
          <div className="arc-alert arc-alert--error">
            <Mark name="circle-alert" className="arc-icon arc-alert__icon" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Ilja, 2026-11-25: the pair spans the panel above them, edge to edge, Delete first, and the
            way back carries an outline so it reads as a button and not as a caption. */}
        <div className="mt-2 grid w-full grid-cols-2 gap-2">
          <button
            type="button"
            className="arc-btn arc-btn--danger w-full"
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
            {confirmId === open.id ? 'Tap again to delete' : 'Delete session'}
          </button>
          <button
            type="button"
            className="arc-btn arc-btn--secondary w-full"
            onClick={() => {
              setOpenId(null);
              setConfirmId(null);
            }}
          >
            All sessions
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="history-title">
      <p className="arc-section-label" id="history-title">
        History
      </p>
      <p className="arc-small arc-muted">
        {`${history.sessions.length} ${history.sessions.length === 1 ? 'session' : 'sessions'}`}
      </p>

      <div className="arc-panel arc-panel--flat">
        {history.sessions.map((session) => (
          <button type="button" className="arc-item" key={session.id} onClick={() => setOpenId(session.id)}>
            <span className="arc-item__text">
              <span className="arc-item__title">{formatSessionDate(session.date)}</span>
              <span className="arc-item__meta">{mainExercise(session, baseIds)}</span>
            </span>
            <span className="arc-item__end">
              <span className="arc-chip">{`${formatNumber(tonne(session))} kg`}</span>
              <span className="arc-item__chevron" aria-hidden="true">
                <Mark name="chevron-right" />
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
