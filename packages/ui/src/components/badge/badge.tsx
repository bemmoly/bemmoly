import type { HTMLAttributes } from 'react';
import { cx } from '../../lib/cx.ts';

export type BadgeTone =
  'neutral' | 'accent' | 'ok' | 'warn' | 'violet' | 'amber' | 'solid' | 'outline';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-line-2 text-tx-2',
  accent: 'bg-acc-50 text-acc',
  ok: 'bg-green-50 text-green-tx',
  warn: 'bg-amber-50 text-amber-tx',
  violet: 'bg-acc-50 text-acc',
  amber: 'bg-acc-50 text-acc',
  solid: 'bg-acc-fill text-on-acc',
  outline: 'border border-line text-tx-3',
};

/**
 * label: ACTIVE, RECOMMENDED, CONNECTED, RESOLVES (11px semibold, 2px 7px, 3px radius).
 * count: the mono counts on tabs, sprint headers and the inbox title (11px, 1px 6px, pill).
 */
const VARIANTS = {
  label: 'rounded-chip px-1.75 py-0.5 text-11 font-semibold',
  count: 'rounded-full px-1.5 py-px font-mono text-11 font-medium',
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
