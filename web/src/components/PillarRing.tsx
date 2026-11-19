interface PillarRingProps {
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

/** A ring that fills from nothing to the floor: a quarter at one set, full at four. */
export function PillarRing({ label, sets, floor, size = 'md' }: PillarRingProps) {
  const done = floor > 0 && sets >= floor;
  const colour = done ? 'var(--status-in)' : 'var(--status-below)';
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
        <span className="absolute inset-0 flex items-center justify-center font-mono text-lg font-semibold tabular-nums">
          {formatNumber(sets)}
        </span>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-[10px] font-semibold" style={{ color: colour }}>
        {done ? 'OK' : `${formatNumber(Math.max(0, floor - sets))} more`}
      </span>
    </div>
  );
}
