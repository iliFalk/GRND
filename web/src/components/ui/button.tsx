import type * as React from 'react';
import { cn } from '../../lib/utils';

/** The product's button is the system's: one action, 44 px floor, a variant per weight. `sm` and `icon`
 *  keep the floor; the system has no smaller size, and a 32 px control was measured failing the hand. */
const variants = {
  default: 'arc-btn arc-btn--primary',
  secondary: 'arc-btn arc-btn--secondary',
  outline: 'arc-btn arc-btn--secondary',
  ghost: 'arc-btn arc-btn--ghost',
  danger: 'arc-btn arc-btn--danger'
} as const;

const sizes = {
  default: '',
  sm: '',
  icon: 'arc-icon-btn'
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export function Button({
  className,
  variant = 'default',
  size = 'default',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(variants[variant] ?? variants.default, sizes[size] ?? '', className)}
      {...props}
    />
  );
}
