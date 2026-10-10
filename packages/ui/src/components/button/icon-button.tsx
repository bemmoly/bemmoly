import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';

export type IconButtonSize = 'tool' | 'xs' | 'sm' | 'md';

/**
 * Square buttons: 22 (a card's hover tools and a column header's + and ···), 28 (drawer header ⤢ ··· ✕), 30 (Issue toolbar ···) and 32 (top bar inbox,
 * help and settings; Board header ···).
 */
const SIZES: Record<IconButtonSize, string> = {
  tool: 'size-5.5 rounded-xs',
  xs: 'size-7 rounded-sm',
  sm: 'size-7.5 rounded-sm',
  md: 'size-control rounded-control',
};

const VARIANTS = {
  ghost:
    'border-0 bg-transparent enabled:hover:bg-hover enabled:hover:text-tx enabled:active:bg-press',
  secondary: cx(
    'border border-line bg-card',
    'enabled:hover:shadow-[inset_0_0_0_99px_var(--hover)] enabled:active:shadow-[inset_0_0_0_99px_var(--press)]',
  ),
} as const;

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Required: the button has no visible text. */
  label: string;
  icon: IconName | ReactNode;
  size?: IconButtonSize;
  variant?: keyof typeof VARIANTS;
  /** A count in the corner, as on the top bar inbox. */
  badge?: number | string;
}

export function IconButton({
  label,
  icon,
  size = 'md',
  variant = 'ghost',
  badge,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const hasBadge = badge !== undefined && badge !== 0 && badge !== '';
  return (
    <button
      type={type}
      aria-label={hasBadge ? `${label}, ${badge}` : label}
      title={label}
      className={cx(
        'relative inline-flex shrink-0 cursor-pointer items-center justify-center font-semibold text-tx2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'motion-safe:transition-[color,background-color,translate] enabled:active:translate-y-px',
        SIZES[size],
        VARIANTS[variant],
        focusRing,
        className,
      )}
      {...rest}
    >
      {typeof icon === 'string' ? <Icon name={icon as IconName} /> : icon}
      {hasBadge && (
        <span
          aria-hidden
          className="absolute top-1.25 right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-danger px-0.75 text-10 font-semibold text-on-solid"
        >
          {badge}
        </span>
      )}
    </button>
  );
}
