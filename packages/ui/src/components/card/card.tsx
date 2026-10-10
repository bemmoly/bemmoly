import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** 8px (settings, Home, Issue sidebars) or 7px (drawer details, subtask lists). */
  radius?: 'card' | 'panel';
}

/** White surface, 1px br border, clipped corners. */
export function Card({ radius = 'card', className, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        'overflow-hidden border border-line bg-card',
        radius === 'card' ? 'rounded-card' : 'rounded-control',
        className,
      )}
      {...rest}
    />
  );
}

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  /** Lighter text after the title, e.g. "updates as you edit". */
  hint?: ReactNode;
  /** Right-aligned actions such as "View all". */
  actions?: ReactNode;
  /** The Issue and drawer sidebars: tinted bar, 10px 14px. Default: 12px 16px on the surface. */
  subtle?: boolean;
}

export function CardHeader({ title, hint, actions, subtle, className, ...rest }: CardHeaderProps) {
  return (
    <div
      className={cx(
        'flex items-center gap-2 border-b border-line-2 font-semibold',
        subtle ? 'bg-side px-3.5 py-2.5' : 'px-4 py-3',
        className,
      )}
      {...rest}
    >
      <span>{title}</span>
      {hint && <span className="text-12 font-normal text-tx-3">{hint}</span>}
      {actions && (
        <span className="ml-auto flex items-center gap-2 text-13 font-medium">{actions}</span>
      )}
    </div>
  );
}

export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  /** list: rows with dividers (6px 16px); default: 16px. */
  layout?: 'block' | 'list';
}

export function CardBody({ layout = 'block', className, ...rest }: CardBodyProps) {
  return (
    <div
      className={cx(layout === 'list' ? 'flex flex-col px-4 py-1.5' : 'p-4', className)}
      {...rest}
    />
  );
}

export interface SelectableCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
}

/**
 * Option cards (theme presets, importers, swimlane and estimation choices): selected shows the
 * accent border and the 2px ac-br ring. Use inside a role="radiogroup" for single choice.
 */
export function SelectableCard({ selected, className, ...rest }: SelectableCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={cx(
        'flex cursor-pointer flex-col gap-2 rounded-card border bg-card p-4 text-left font-sans text-13 text-tx',
        selected ? 'border-acc shadow-ring' : 'border-line',
        focusRing,
        className,
      )}
      {...rest}
    />
  );
}
