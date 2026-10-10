import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';

export interface PropertyGroupProps extends HTMLAttributes<HTMLElement> {
  /** "Properties", "Planning", "People". */
  title: string;
  children: ReactNode;
}

/**
 * One group of the Issue page's right rail: a rule above, the group's name in 11px tx-3 and
 * its rows (docs/design/premium/screens.js, screenIssue).
 */
export function PropertyGroup({ title, children, className, ...rest }: PropertyGroupProps) {
  return (
    <section
      aria-label={title}
      className={cx('flex flex-col border-t border-line py-3.5', className)}
      {...rest}
    >
      <h3 className="m-0 mb-1 text-11 font-semibold text-tx-3">{title}</h3>
      {children}
    </section>
  );
}

export interface PropertyRowProps {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A property: the 96px label in tx-3, then the value, at least 32px tall. */
export function PropertyRow({ label, children, className }: PropertyRowProps) {
  return (
    <div
      className={cx('grid min-h-8 grid-cols-[96px_minmax(0,1fr)] items-center gap-2', className)}
    >
      <span className="truncate text-13 text-tx-3">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

/**
 * The value side of a property as one editable control: it reads as text, and the hover overlay
 * shows that it can be changed. Pickers pass it as their trigger's className.
 */
export const propertyValueClass = cx(
  '-ml-1.5 inline-flex min-h-7 min-w-0 max-w-full cursor-pointer items-center gap-1.75 rounded-panel border-0 bg-transparent px-1.5 py-1 text-left font-sans text-13 text-tx hover:bg-hover aria-expanded:bg-hover',
  focusRing,
);

export type PropertyValueProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** A property's value as a button that opens its editor. */
export function PropertyValue({ className, type = 'button', ...rest }: PropertyValueProps) {
  return <button type={type} className={cx(propertyValueClass, className)} {...rest} />;
}

/** "Add date", "Add version": an empty value, in tx-3, never "None". */
export function PropertyEmpty({ children }: { children: ReactNode }) {
  return <span className="truncate text-tx-3">{children}</span>;
}
