import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';

export interface EmptyStateProps {
  /** An Icon or glyph shown in a 36px chip tile (28px when small). */
  icon?: ReactNode;
  title: ReactNode;
  /** Why it is empty and what to do next, in plain words. */
  description?: ReactNode;
  /** Usually one Button. */
  action?: ReactNode;
  /**
   * md: a page or a panel with nothing in it. sm: one container inside a list, such as an
   * empty sprint, where the full state would push the next container off the screen.
   */
  size?: 'md' | 'sm';
  /**
   * The title as a heading of this level, for a state that is the whole screen (1) or a
   * section's (2, 3); a paragraph without it, inside a list that has its own heading.
   */
  headingLevel?: 1 | 2 | 3;
  className?: string;
}

const SIZES = {
  md: { box: 'gap-2 px-6 py-10', tile: 'mb-1 size-9', title: 'text-14' },
  sm: { box: 'gap-1 px-4 py-5', tile: 'mb-1 size-7', title: 'text-13' },
} as const;

/**
 * No mock shows an empty list. Built from mock parts: the 36px, 7px-radius tile of the
 * Appearance logo row (on chip, in tx4), a 14px semibold title and 12.5px tx4 copy at 1.5. It
 * fades in, so a list that empties does not blink.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'md',
  headingLevel,
  className,
}: EmptyStateProps) {
  const look = SIZES[size];
  const Title = headingLevel ? (`h${headingLevel}` as const) : 'p';
  return (
    <div
      className={cx(
        'flex flex-col items-center text-center motion-safe:animate-fade-in',
        look.box,
        className,
      )}
    >
      {icon && (
        <span
          aria-hidden
          className={cx(
            'flex items-center justify-center rounded-control bg-line-2 text-tx-3',
            look.tile,
          )}
        >
          {icon}
        </span>
      )}
      <Title className={cx('m-0 font-semibold text-tx', look.title)}>{title}</Title>
      {description && <p className="m-0 max-w-90 text-13 leading-body text-tx-3">{description}</p>}
      {action && <div className={size === 'sm' ? 'mt-1.5' : 'mt-2'}>{action}</div>}
    </div>
  );
}
