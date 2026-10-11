import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { IconButton } from '../button/icon-button.tsx';

export interface EpicItemProps {
  name: string;
  epicKey: string;
  /** The epic's stored colour as a background utility (see epicFill). */
  colorClassName: string;
  /** Percent of its issues done. */
  progress: number;
  /** "12 issues · 5 done", for the tooltip and assistive tech. */
  meta?: string;
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
}

/**
 * One epic in the rail: its colour square, name and percentage, then a 4px bar in the same
 * colour. The chosen one lifts onto a card, the way the review draws it.
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
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const Tag = onSelect ? 'button' : 'div';
  return (
    <Tag
      type={onSelect ? 'button' : undefined}
      aria-pressed={onSelect ? selected : undefined}
      aria-label={`${name}, ${epicKey}, ${pct}% done${meta ? `, ${meta}` : ''}`}
      title={meta ? `${epicKey} · ${meta}` : epicKey}
      onClick={onSelect}
      className={cx(
        'flex w-full flex-col gap-2 rounded-card border-0 px-3 py-2.5 text-left font-sans text-13 text-tx',
        'motion-safe:transition-[background-color,box-shadow]',
        selected ? 'bg-card shadow-e1' : 'bg-transparent',
        onSelect && cx('cursor-pointer', !selected && 'hover:bg-hover', focusRing),
        className,
      )}
    >
      <span className="flex w-full items-center gap-2">
        <i aria-hidden className={cx('size-2.5 shrink-0 rounded-[3px]', colorClassName)} />
        <span className="min-w-0 flex-1 truncate font-[550]">{name}</span>
        <span className="text-12 text-tx-3 tabular-nums">{pct}%</span>
      </span>
      <span aria-hidden className="block h-1 w-full overflow-hidden rounded-[2px] bg-line">
        <i
          className={cx('block h-full rounded-[2px]', colorClassName)}
          style={{ width: `${pct}%` }}
        />
      </span>
    </Tag>
  );
}

export interface EpicPanelProps {
  title?: string;
  onCreate?: () => void;
  children: ReactNode;
  className?: string;
}

/** The quiet epics rail beside the backlog: 190px on the sunken surface. */
export function EpicPanel({ title = 'Epics', onCreate, children, className }: EpicPanelProps) {
  return (
    <aside
      aria-label={title}
      className={cx(
        'flex w-47.5 shrink-0 flex-col border-r border-line bg-sunken px-2.5 py-3 text-13 text-tx',
        className,
      )}
    >
      <div className="flex items-center px-1 pb-2">
        <h2 className="m-0 flex-1 text-13 font-semibold">{title}</h2>
        {onCreate && <IconButton size="tool" label="New epic" icon="plus" onClick={onCreate} />}
      </div>
      <div className="-mx-1 flex flex-col gap-1 overflow-auto px-1">{children}</div>
    </aside>
  );
}
