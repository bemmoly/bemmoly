import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { IconButton } from '../button/icon-button.tsx';
import { Kbd } from '../kbd/kbd.tsx';

export interface BulkBarProps {
  /** How many items are selected; the bar shows from one. */
  count: number;
  /** "issue" / "issues" by default. */
  noun?: [string, string];
  /** The actions, each a button or a menu already wired to its trigger. */
  children: ReactNode;
  onClear: () => void;
  className?: string;
}

/**
 * The floating bar a selection brings up: it rises from the bottom centre with the count, the
 * bulk actions and a way out (Esc). It never covers the bottom bar on phones.
 */
export function BulkBar({
  count,
  noun = ['issue', 'issues'],
  children,
  onClear,
  className,
}: BulkBarProps) {
  if (count === 0) return null;
  return (
    <div
      role="toolbar"
      aria-label={`${count} ${count === 1 ? noun[0] : noun[1]} selected`}
      className={cx(
        'fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-dialog border border-line bg-card p-1.5 text-13 text-tx shadow-e3',
        'motion-safe:animate-rise max-md:bottom-20',
        className,
      )}
    >
      <span className="flex shrink-0 items-center gap-2 pr-2 pl-2.5 font-semibold tabular-nums">
        {count} selected
      </span>
      <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-line" />
      {children}
      <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-line" />
      <span className="flex shrink-0 items-center gap-1.5 pr-1 text-12 text-tx-3">
        <Kbd keys="Escape" variant="plain" />
        <IconButton label="Clear selection" icon="close" size="xs" onClick={onClear} />
      </span>
    </div>
  );
}
