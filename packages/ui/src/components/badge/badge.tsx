import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/cx.ts';

export type BadgeTone =
  'neutral' | 'accent' | 'ok' | 'warn' | 'violet' | 'amber' | 'solid' | 'outline';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-chip text-tx3',
  accent: 'bg-ac-bg text-ac',
  ok: 'bg-ok-bg text-ok-fg',
  warn: 'bg-warn-bg text-warn-fg',
  violet: 'bg-st-rev-bg text-st-rev-fg',
  amber: 'bg-st-qa-bg text-st-qa-fg',
  solid: 'bg-ac-fill text-on-ac',
  outline: 'border border-br3 text-tx5',
};

/**
 * label: ACTIVE, RECOMMENDED, CONNECTED, RESOLVES (11px semibold, 2px 7px, 3px radius).
 * count: the mono counts on tabs, sprint headers and the inbox title (11px, 1px 6px, pill).
 */
const VARIANTS = {
  label: 'rounded-chip px-1.75 py-0.5 text-11 font-semibold',
  count: 'rounded-pill px-1.5 py-px font-mono text-11 font-medium',
} as const;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  variant?: keyof typeof VARIANTS;
}

export function Badge({ tone = 'neutral', variant = 'label', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center whitespace-nowrap',
        VARIANTS[variant],
        TONES[tone],
        className,
      )}
      {...rest}
    />
  );
}
