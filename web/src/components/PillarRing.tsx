interface PillarRingProps {
  /** The pillar's id: it names the colour, so the label and the week column match. */
  id: string;
  label: string;
  /** What has been done: sets of the week on the dashboard, sets of this workout in the train. */
  sets: number;
  /** The floor the meter fills against. */
  floor: number;
  size?: 'sm' | 'md';
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** The colour of a pillar, from the theme: `--pillar-pull`, `--pillar-push`, … */
export function pillarColor(id: string): string {
  return `var(--pillar-${id})`;
}

/**
 * The system has no ring: its progress is a meter — a track with a chamfered fill, read against the
 * floor. A circle was the one shape the grammar forbids (zero radius, no round form), so the four
 * pillars read as four meters. The name carries the hue, the meter carries the amount, and no letter
 * stands in for the name.
 */
export function PillarRing({ id, label, sets, floor, size = 'md' }: PillarRingProps) {
  const done = floor > 0 && sets >= floor;
  const colour = pillarColor(id);
  const percent = floor > 0 ? Math.min(100, (sets / floor) * 100) : 0;
  const tight = size === 'sm';

  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className={tight ? 'arc-micro' : 'arc-label'} style={{ color: colour }}>
          {label}
        </span>
        <span className="arc-data">{`${formatNumber(sets)} / ${formatNumber(floor)}`}</span>
      </div>
      <div
        className="arc-meter"
        role="img"
        aria-label={`${label}: ${formatNumber(sets)} sets, ${formatNumber(floor)} needed`}
      >
        <div className="arc-meter__track">
          <div
            className="arc-meter__fill"
            style={{ '--arc-meter-value': `${percent}%` } as React.CSSProperties}
          />
        </div>
      </div>
      <span className="arc-micro">{done ? 'Floor met' : `${formatNumber(Math.max(0, floor - sets))} more`}</span>
    </div>
  );
}
