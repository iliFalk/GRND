import { useState } from 'react';
import { formatWeekRange } from '../lib/format';
import { useBlock, type BlockExercise, type BlockWeek, type Verdict } from '../lib/block';
import { pillarColor } from './PillarRing';

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Thousands with a thin space: the number stays one word on a phone. */
function formatBig(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** `2–29 Nov`, without the year: a comparison never crosses one, and the year is noise here. */
function shortRange(from: string | null, to: string | null): string {
  const full = formatWeekRange(from, to);
  return full === null ? '' : full.replace(/\s\d{4}$/, '');
}

/** The pillars in the order the screen shows them; a movement outside them comes last. */
const PILLARS: { id: string; label: string }[] = [
  { id: 'pull', label: 'Pull' },
  { id: 'push', label: 'Push' },
  { id: 'legs', label: 'Legs' },
  { id: 'core', label: 'Core' }
];

/** A block of work in tonnes: 7 732 kg is 7.7 t, and one decimal is all a week needs. */
function tonnes(value: number): string {
  return `${(value / 1000).toFixed(1)} t`;
}

function behind(value: number | null): string {
  const text = signed(value);
  return text === '' ? '' : ` ${text}`;
}

function signed(value: number | null): string {
  if (value === null || value === 0) return '';
  return value > 0 ? `+${formatNumber(value)}` : `-${formatNumber(Math.abs(value))}`;
}

/** The three levels, in the words of the screen. `down` outranks volume: the top set fell. */
const VERDICT: Record<Verdict, { label: string; tone: string }> = {
  progress: { label: 'Progress', tone: 'arc-chip arc-chip--ok' },
  hold: { label: 'Holding', tone: 'arc-chip' },
  less: { label: 'Less work', tone: 'arc-chip arc-chip--attention' },
  down: { label: 'Backing off', tone: 'arc-chip arc-chip--attention' },
  open: { label: 'First block', tone: 'arc-chip' }
};

/** One week of the block: its label, its work, and the change against the week before it. */
function WeekCell({ week }: { week: BlockWeek }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={week.closed ? 'text-[10px] text-muted-foreground' : 'text-[10px] font-semibold text-primary'}>
        {`W${week.week}`}
      </span>
      <span className="text-[10px] tabular-nums text-muted-foreground">
        {week.work > 0 ? tonnes(week.work) : '—'}
      </span>
      <span className="arc-item__meta">
        {week.work > 0 ? (week.closed ? (signed(week.change) === '' ? '' : `${signed(week.change)} %`) : `${week.sessions}/3`) : ''}
      </span>
    </div>
  );
}

interface BlockPanelProps {
  userId: string;
}

/**
 * The block grid: four weeks of work, the level against the block before, and the peak.
 *
 * Ilja, 2026-11-23: an open block is a pace, a closed one is a level — the screen names which. The
 * effort tap sits here because it changes what the block is worth, and one tap is the whole cost.
 */
/** One exercise of the block: its sets and reps, the heaviest weight, and the change against the base. */
function ExerciseRow({ row }: { row: BlockExercise }) {
  const weight = row.bodyweight ? 'bw' : row.top_weight === null ? '—' : `${formatNumber(row.top_weight)} kg`;
  return (
    <div className="arc-item arc-item--wrap">
      <span className="arc-item__text">
        <span className="arc-item__title">{row.name}</span>
        <span className="arc-item__meta">
          {`${formatNumber(row.sets)} sets${behind(row.delta_sets)} · ${formatNumber(row.reps)} reps${behind(row.delta_reps)}`}
        </span>
      </span>
      <span className="arc-item__end">
        <span className="arc-kv__value">{`${weight}${row.bodyweight ? '' : behind(row.delta_top_weight)}`}</span>
      </span>
    </div>
  );
}

export function BlockPanel({ userId }: BlockPanelProps) {
  const block = useBlock(userId);
  const [open, setOpen] = useState(false);
  const data = block.data;
  const range = data ? shortRange(data.from, data.to) : null;
  const verdict = data ? VERDICT[data.verdict] : null;

  if (block.error) {
    return (
      <div className="arc-panel">
        <p className="arc-section-label">Block</p>
        <p className="arc-empty__text">{block.error.message}</p>
        <button type="button" className="arc-btn arc-btn--secondary" onClick={block.reload}>
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="arc-panel">
        <span className="arc-skeleton" style={{ '--arc-skeleton-width': '50%' } as React.CSSProperties} />
        <span className="arc-skeleton" style={{ '--arc-skeleton-width': '70%' } as React.CSSProperties} />
      </div>
    );
  }

  return (
    <div className="arc-panel">
      <div className="arc-panel__head">
        <p className="arc-section-label">{`Week ${data.week} of 4`}</p>
        {range ? <span className="arc-small arc-muted">{range}</span> : null}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {data.weeks.map((week) => (
          <WeekCell key={week.week} week={week} />
        ))}
      </div>

      <p className="arc-small arc-muted">Tonnes per week · change vs last week · 1/3 sessions done</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="arc-readout">
          <span className="arc-readout__label">{data.measured === 'level' ? 'Work' : 'Pace'}</span>
          <span className="arc-readout__value">
            {data.work_index === null ? '—' : formatNumber(data.work_index)}
          </span>
          <span className="arc-small arc-muted">
            {data.work_index === null
              ? 'no block before'
              : data.base
                ? `100 = block ${formatWeekRange(data.base.from, data.base.to) ?? 'before'}`
                : '100 = the block before'}
          </span>
        </div>
        <div className="arc-readout">
          <span className="arc-readout__label">Peak</span>
          <span className="arc-readout__value">
            {data.peak_index === null ? '—' : formatNumber(data.peak_index)}
          </span>
          <span className="arc-small arc-muted">
            {data.peak_index === null ? 'best set, per exercise' : 'best set, per exercise'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {verdict ? (
          <span className={verdict.tone}>
            <i className="arc-chip__dot" />
            {data.plateau ? 'Plateau' : verdict.label}
          </span>
        ) : null}
        <span className="arc-small arc-muted">{`${data.sessions} sessions · ${formatBig(data.work)} kg`}</span>
      </div>

      <button type="button" className="arc-item" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="arc-item__text">
          <span className="arc-item__title">Exercises</span>
          <span className="arc-item__meta">
            {data.base
              ? `${shortRange(data.from, data.to)} vs ${shortRange(data.base.from, data.base.to)}`
              : shortRange(data.from, data.to)}
          </span>
        </span>
        <span className="arc-item__end">
          {PILLARS.map((pillar, index) => {
            const count = data.exercises.filter((row) => row.pillar === pillar.id).length;
            if (count === 0) return null;
            return (
              <span key={pillar.id} className="arc-kv__value" style={{ color: pillarColor(pillar.id) }}>
                {index === 0 ? count : `· ${count}`}
              </span>
            );
          })}
          <svg className="arc-icon arc-item__chevron" aria-hidden="true">
            <use href={`/icons.svg#chevron-${open ? 'up' : 'down'}`} />
          </svg>
        </span>
      </button>

      {open ? (
        data.exercises.length === 0 ? (
          <p className="arc-empty__text">No set is recorded in this block.</p>
        ) : (
          [...PILLARS, { id: 'other', label: 'Outside the pillars' }].map((pillar) => {
            const rows =
              pillar.id === 'other'
                ? data.exercises.filter((row) => !PILLARS.some((known) => known.id === row.pillar))
                : data.exercises.filter((row) => row.pillar === pillar.id);
            if (rows.length === 0) return null;

            return (
              <div key={pillar.id} className="flex flex-col">
                <p className="arc-section-label" style={{ color: pillarColor(pillar.id) }}>
                  {pillar.label}
                </p>
                {rows.map((row) => (
                  <ExerciseRow key={row.name} row={row} />
                ))}
              </div>
            );
          })
        )
      ) : null}

      {data.plateau ? (
        <p className="arc-small arc-muted">Two blocks at the same level: the same work stops paying.</p>
      ) : null}
    </div>
  );
}
