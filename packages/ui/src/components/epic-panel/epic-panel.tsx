import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing, focusRingInset } from '../../lib/focus.ts';
import { ProgressBar } from '../progress-bar/progress-bar.tsx';

export interface EpicItemProps {
  name: ReactNode;
  epicKey: string;
  /** The epic colour as a background utility (bg-ac, bg-violet). */
  colorClassName: string;
  /** Percent of its issues done. */
  progress: number;
  /** "9 issues · due Oct 7". */
  meta?: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
}

/**
 * One epic in the Backlog's side panel: 10px 14px over a br-row rule, the 10px colour square,
 * the name in semibold, the key in mono tx5, then the 5px progress bar with its percentage and
 * the meta line in 12px. Selected sits on the accent tint.
 */
export function EpicItem({
  name,
  epicKey,
  colorClassName,
  progress,
  meta,
  selected = false,
  onSelect,
  className,
}: EpicItemProps) {
  const pct = Math.round(progress);
  const Tag = onSelect ? 'button' : 'div';
  return (
    <Tag
      type={onSelect ? 'button' : undefined}
      aria-pressed={onSelect ? selected : undefined}
      onClick={onSelect}
      className={cx(
        'flex w-full flex-col gap-1.5 border-0 border-b border-br-row px-3.5 py-2.5 text-left font-sans text-13 text-tx',
        'motion-safe:transition-colors',
        selected ? 'bg-ac-bg' : 'bg-sf',
        onSelect && cx('cursor-pointer', !selected && 'hover:bg-bg2', focusRingInset),
        className,
      )}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden className={cx('size-2.5 shrink-0 rounded-chip', colorClassName)} />
        <span className="flex-1 font-semibold">{name}</span>
        <span className="font-mono text-11 font-medium text-tx5">{epicKey}</span>
      </span>
      <span className="flex items-center gap-2 text-12 text-tx4">
        <ProgressBar
          value={pct}
          label={`${typeof name === 'string' ? name : 'Epic'} progress`}
          fillClassName={colorClassName}
          className="flex-1"
        />
        {/* A fixed, tabular slot, so every bar in the panel ends at the same place. */}
        <span className="min-w-8 text-right tabular-nums">{pct}%</span>
      </span>
      {meta && <span className="text-12 text-tx5 tabular-nums">{meta}</span>}
    </Tag>
  );
}

export interface EpicPanelProps {
  title?: ReactNode;
  onCreate?: () => void;
  children: ReactNode;
  className?: string;
}

/** The 260px panel beside the backlog: "Epics" and "+ Create" over the items. */
export function EpicPanel({ title = 'Epics', onCreate, children, className }: EpicPanelProps) {
  return (
    <aside
      aria-label={typeof title === 'string' ? title : 'Epics'}
      className={cx(
        'flex w-65 shrink-0 flex-col border-r border-br bg-sf text-13 text-tx',
        className,
      )}
    >
      <div className="flex items-center border-b border-br2 px-3.5 py-3 font-semibold">
        {title}
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className={cx(
              'ml-auto cursor-pointer rounded-xs border-0 bg-transparent p-0 font-sans text-12h font-medium text-ac hover:text-ac-d',
              focusRing,
            )}
          >
            + Create
          </button>
        )}
      </div>
      <div className="flex flex-col overflow-auto">{children}</div>
    </aside>
  );
}
