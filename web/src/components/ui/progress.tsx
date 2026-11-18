import type * as React from 'react';
import { cn } from '../../lib/utils';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  indicatorClassName?: string;
  indicatorStyle?: React.CSSProperties;
}

export function Progress({
  value = 0,
  className,
  indicatorClassName,
  indicatorStyle,
  ...props
}: ProgressProps) {
  const percent = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      className={cn('h-2 w-full overflow-hidden rounded-pill bg-muted', className)}
      {...props}
    >
      <div
        className={cn('h-full rounded-pill transition-[width] duration-300', indicatorClassName)}
        style={{ width: `${percent}%`, ...indicatorStyle }}
      />
    </div>
  );
}
