interface PillarRingProps {
  /** The pillar's id: it names the colour, so the ring and the day column match. */
  id: string;
  label: string;
  /** What has been done: sets of the week on the dashboard, sets of this workout in the train. */
  sets: number;
  /** The floor the ring fills against. */
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

/** A ring that fills from nothing to the floor: a quarter at one set, full at four. */
export function PillarRing({ id, label, sets, floor, size = 'md' }: PillarRingProps) {
  const done = floor > 0 && sets >= floor;
  const colour = pillarColor(id);
  const percent = floor > 0 ? Math.min(100, (sets / floor) * 100) : 0;
  const box = size === 'sm' ? 'h-12 w-12' : 'h-14 w-14';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative ${box}`}>
        <svg
          viewBox="0 0 36 36"
          className={box}
          role="img"
          aria-label={`${label}: ${formatNumber(sets)} sets, ${formatNumber(floor)} needed`}
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
        {/* The arc carries its letter as well as its hue: a reader who cannot separate two colours still
            tells the pillars apart, which is what the system asks of a category (D10). */}
        <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
            {formatNumber(sets)}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: colour }} aria-hidden="true">
            {label.slice(0, 1)}
          </span>
        </span>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: colour }}>
        {label}
      </span>
      <span
        className="text-[10px] font-semibold"
        style={{ color: done ? 'var(--status-in)' : 'var(--status-below)' }}
      >
        {done ? 'OK' : `${formatNumber(Math.max(0, floor - sets))} more`}
      </span>
    </div>
  );
}
