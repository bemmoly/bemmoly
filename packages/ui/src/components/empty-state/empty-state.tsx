import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';

export interface EmptyStateProps {
  /** An Icon or glyph shown in a 36px chip tile. */
  icon?: ReactNode;
  title: ReactNode;
  /** Why it is empty and what to do next, in plain words. */
  description?: ReactNode;
  /** Usually one Button. */
  action?: ReactNode;
  className?: string;
}

/**
 * No mock shows an empty list. Built from mock parts: the 36px, 7px-radius tile of the
 * Appearance logo row (on chip, in tx4), a 14px semibold title and 12.5px tx4 copy at 1.5.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cx('flex flex-col items-center gap-2 px-6 py-10 text-center', className)}>
      {icon && (
        <span
          aria-hidden
          className="mb-1 flex size-9 items-center justify-center rounded-panel bg-chip text-tx4"
        >
          {icon}
        </span>
      )}
      <p className="m-0 text-14 font-semibold text-tx">{title}</p>
      {description && <p className="m-0 max-w-90 text-12h leading-body text-tx4">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
