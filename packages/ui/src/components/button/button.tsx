import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { Spinner } from '../spinner/spinner.tsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'bar';

const BASE = cx(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 font-sans font-medium',
  'whitespace-nowrap select-none disabled:cursor-not-allowed disabled:opacity-50',
  focusRing,
);

/**
 * Heights from the mocks: 28 (Backlog sprint header), 30 (board drawer and Issue toolbar),
 * 32 (page headers; the control height token), 38 (Setup wizard) and the top bar's Create,
 * which is sized by its padding (6px 14px, 29px tall).
 */
const SIZES: Record<ButtonSize, string> = {
  xs: 'h-7 rounded-sm px-2.5 text-12h',
  sm: 'h-7.5 rounded-sm px-2.5 text-13',
  md: 'h-control rounded-control text-13',
  lg: 'h-9.5 rounded-control text-14',
  bar: 'rounded-control py-1.5 text-13',
};

/** Primary buttons carry more padding than bordered ones at the same height, as in the mocks. */
const PADDING: Partial<Record<`${ButtonVariant}-${ButtonSize}`, string>> = {
  'primary-md': 'px-3.5',
  'danger-md': 'px-3.5',
  'secondary-md': 'px-3',
  'ghost-md': 'px-3',
  'primary-lg': 'px-4.5',
  'danger-lg': 'px-4.5',
  'secondary-lg': 'px-3.5',
  'ghost-lg': 'px-3.5',
  'primary-bar': 'px-3.5',
  'secondary-bar': 'px-3.5',
  'ghost-bar': 'px-3.5',
  'danger-bar': 'px-3.5',
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-0 bg-ac-fill text-on-ac enabled:hover:brightness-95',
  secondary: 'border border-br3 bg-sf text-tx2 enabled:hover:bg-bg2',
  ghost: 'border-0 bg-transparent text-tx4 enabled:hover:bg-chip enabled:hover:text-tx2',
  danger: 'border-0 bg-danger text-on-solid enabled:hover:brightness-95',
};

export interface ButtonStyle {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** 10px side padding, as on the filter and menu triggers ("Epic ▾"). */
  tight?: boolean;
  className?: string;
}

/** The classes of a button, for links and other elements that must look like one. */
export function buttonClassName({
  variant = 'secondary',
  size = 'md',
  block,
  tight,
  className,
}: ButtonStyle = {}): string {
  const padding = tight ? 'px-2.5' : PADDING[`${variant}-${size}`];
  return cx(BASE, SIZES[size], padding, VARIANTS[variant], block && 'w-full', className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyle {
  /** Leading icon, replaced by a spinner while loading. */
  icon?: ReactNode;
  /** Trailing content such as a caret or a key hint. */
  iconEnd?: ReactNode;
  /** Disables the button and shows a spinner; the label stays so the width does not jump. */
  loading?: boolean;
}

export function Button({
  variant,
  size,
  block,
  tight,
  className,
  icon,
  iconEnd,
  loading = false,
  disabled,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClassName({ variant, size, block, tight, className })}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {iconEnd}
    </button>
  );
}
