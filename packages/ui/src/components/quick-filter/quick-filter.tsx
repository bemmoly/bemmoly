import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';

export interface QuickFilterChipProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onToggle'
> {
  active: boolean;
  onToggle: () => void;
}

/**
 * A quick filter from the Board's filter row: a 28px pill (14px radius), 10px side padding,
 * 12.5px medium. Off is the surface with the br3 border in tx2; on is the accent tint with the
 * accent border and text.
 */
export function QuickFilterChip({
  active,
  onToggle,
  className,
  type = 'button',
  ...rest
}: QuickFilterChipProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      onClick={onToggle}
      className={cx(
        'inline-flex h-7 shrink-0 cursor-pointer items-center rounded-full border px-2.5 font-sans text-12h font-medium whitespace-nowrap',
        active ? 'border-ac bg-ac-bg text-ac' : 'border-br3 bg-sf text-tx2 hover:bg-bg2',
        focusRing,
        className,
      )}
      {...rest}
    />
  );
}

export interface QuickFilterRowProps extends HTMLAttributes<HTMLDivElement> {
  /** Names the group, e.g. "Quick filters". */
  label: string;
  /** Draws the 20px br3 rule before the chips, as after the Label dropdown in the mock. */
  divider?: boolean;
}

/** The chips 8px apart, with the 1px x 20px divider the mock puts between dropdowns and chips. */
export function QuickFilterRow({
  label,
  divider,
  className,
  children,
  ...rest
}: QuickFilterRowProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx('flex flex-wrap items-center gap-2', className)}
      {...rest}
    >
      {divider && <span aria-hidden className="mx-1 h-5 w-px bg-br3" />}
      {children}
    </div>
  );
}
