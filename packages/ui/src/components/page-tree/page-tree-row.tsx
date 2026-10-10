import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRingInset } from '../../lib/focus.ts';
import { Spinner } from '../spinner/spinner.tsx';
import type { DropZone, PageTreeItem } from './tree-model.ts';

/** The mock's indent: 10px, plus 16px a level. */
export const indentOf = (depth: number) => 10 + depth * 16;

export interface PageTreeRowProps {
  item: PageTreeItem;
  href: string;
  active: boolean;
  /** The one row in the tab order (roving tabindex). */
  tabbable: boolean;
  /** The row is being dragged. */
  dragging: boolean;
  /** Where a drop over this row would land, while something is dragged over it. */
  drop: DropZone | null;
  renaming: boolean;
  /** Hover actions: add a child page and the more menu, already built by the tree. */
  actions?: ReactNode;
  draggable: boolean;
  onToggle: () => void;
  onOpen: (event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onFocus: () => void;
  onRename: (title: string) => void;
  onRenameCancel: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}

function RenameField({
  title,
  onRename,
  onCancel,
}: {
  title: string;
  onRename: (title: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(title);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.select(), []);
  const commit = () => (value.trim() === title ? onCancel() : onRename(value.trim()));
  return (
    <input
      ref={input}
      aria-label="Page title"
      value={value}
      placeholder="Untitled"
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') onCancel();
      }}
      className="h-5.5 min-w-0 flex-1 rounded-xs border border-ac bg-sf px-1 font-sans text-13 text-tx outline-none"
    />
  );
}

/**
 * One row of the space sidebar's tree, measured from the Doc Editor mock: 6px 10px padding
 * with 16px a level, 6px radius, 7px gap, a 9px chevron in tx6, 13px tx2; the open page on
 * ac-bg in ac at 500. Rows sit 1px apart.
 */
export function PageTreeRow({
  item,
  href,
  active,
  tabbable,
  dragging,
  drop,
  renaming,
  actions,
  draggable,
  onToggle,
  onOpen,
  onKeyDown,
  onFocus,
  onRename,
  onRenameCancel,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: PageTreeRowProps) {
  const indent = indentOf(item.depth);
  return (
    <div
      role="treeitem"
      id={`tree-${item.id}`}
      data-tree-id={item.id}
      aria-level={item.depth + 1}
      aria-selected={active}
      aria-current={active ? 'page' : undefined}
      aria-expanded={item.hasChildren ? Boolean(item.expanded) : undefined}
      aria-busy={item.loading || undefined}
      tabIndex={tabbable ? 0 : -1}
      draggable={draggable && !renaming}
      onKeyDown={onKeyDown}
      onFocus={(event) => event.target === event.currentTarget && onFocus()}
      onClick={(event) => !renaming && onOpen(event)}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      style={{ paddingLeft: indent }}
      className={cx(
        'group/row relative flex h-7.5 cursor-pointer items-center gap-1.75 rounded-control py-1.5 pr-1.5 text-13 select-none',
        active ? 'bg-ac-bg font-medium text-ac' : 'text-tx2 hover:bg-bg2',
        drop === 'inside' && 'bg-ac-bg2 shadow-ring-ac',
        dragging && 'opacity-50',
        focusRingInset,
      )}
    >
      {drop === 'before' || drop === 'after' ? (
        <span
          aria-hidden
          data-drop-line={drop}
          style={{ left: indent - 4 }}
          className={cx(
            'pointer-events-none absolute right-1 z-10 h-0.5 rounded-full bg-ac',
            drop === 'before' ? '-top-px' : '-bottom-px',
          )}
        >
          <span className="absolute -top-0.75 -left-1 size-2 rounded-full border-2 border-ac bg-sf" />
        </span>
      ) : null}
      <span
        aria-hidden
        onClick={(event) => {
          if (!item.hasChildren) return;
          event.stopPropagation();
          onToggle();
        }}
        className={cx(
          'flex w-2.25 shrink-0 items-center justify-center text-tx6',
          item.hasChildren && 'hover:text-tx3',
        )}
      >
        {item.loading ? (
          <Spinner size={10} />
        ) : item.hasChildren ? (
          <Icon
            name="chevron"
            size={10}
            className={cx(
              'motion-safe:transition-transform motion-safe:duration-150',
              item.expanded && 'rotate-90',
            )}
          />
        ) : null}
      </span>
      {item.icon ? (
        <span aria-hidden className="shrink-0 text-13 leading-none">
          {item.icon}
        </span>
      ) : null}
      {renaming ? (
        <RenameField title={item.title} onRename={onRename} onCancel={onRenameCancel} />
      ) : (
        <a
          href={href}
          tabIndex={-1}
          draggable={false}
          onClick={(event) => event.preventDefault()}
          className="min-w-0 flex-1 truncate text-inherit no-underline hover:text-inherit"
        >
          {item.title || <span className="text-tx5">Untitled</span>}
        </a>
      )}
      {actions && !renaming ? (
        <span
          className={cx(
            'ml-auto flex shrink-0 items-center gap-0.5',
            'opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 has-[[aria-expanded=true]]:opacity-100',
          )}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {actions}
        </span>
      ) : null}
    </div>
  );
}
