interface PillarRingProps {
  /** The pillar's id: it names the colour, so the label and the week column match. */
  id: string;
  label: string;
  /** What has been done: sets of the week on the dashboard, sets of this workout in the train. */
  sets: number;
  /** The floor the segments fill against: one segment per set. */
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
 * A pillar is a tile: the grid gives the shape, and inside it the floor is cut into segments — one per
 * set, filled as the sets are done. The system has no ring (zero radius, no round form), and a meter
 * would draw a fraction nobody trains. The name carries the hue, the segments carry the amount, the line
 * under them carries the state in words.
 */
export function PillarRing({ id, label, sets, floor, size = 'md' }: PillarRingProps) {
  const done = floor > 0 && sets >= floor;
  const colour = pillarColor(id);
  const segments = Math.max(1, Math.round(floor || 1));
  const filled = Math.min(segments, Math.round(sets));
  const tight = size === 'sm';

  return (
    <div className="arc-panel arc-panel--flat">
      <div className="flex items-baseline justify-between gap-2">
        <span className={tight ? 'arc-micro' : 'arc-label'} style={{ color: colour }}>
          {label}
        </span>
        <span className="arc-data">{`${formatNumber(sets)} / ${formatNumber(floor)}`}</span>
      </div>
      <div className="arc-steps__track" aria-hidden="true">
        {Array.from({ length: segments }, (_, index) => (
          <span
            key={index}
            className={index < filled ? 'arc-steps__seg arc-steps__seg--done' : 'arc-steps__seg'}
          />
        ))}
      </div>
      <span className="arc-micro">{done ? 'Floor met' : `${formatNumber(Math.max(0, floor - sets))} more`}</span>
    </div>
  );
}
