import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Icon } from '../../icons/icon.tsx';
import { PageIcon } from '../../icons/page-icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRingInset } from '../../lib/focus.ts';
import { Spinner } from '../spinner/spinner.tsx';
import type { DropZone, PageTreeItem } from './tree-model.ts';

/** The review's indent (docs-kit.css, `.d-tn`): 14px a level from the tree's own start. */
export const indentOf = (depth: number, start = 6) => start + depth * 14;

/** The attribute on a row's ··· trigger, so a right-click on the row can open the same menu. */
export const ROW_MENU = 'data-row-menu';

export interface PageTreeRowProps {
  item: PageTreeItem;
  href: string;
  /** Where depth 0 starts, in px: under a sidebar row the tree starts one level in. */
  indentStart?: number;
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
      className="h-5.5 min-w-0 flex-1 rounded-chip border border-acc bg-card px-1 font-sans text-13 text-tx outline-none"
    />
  );
}

/**
 * One row of a space's page tree in the sidebar (docs/design/premium/docs/docs-kit.css, `.d-tn`):
 * 28px, an 18px chevron target, the page's icon, the title in the second ink; the open page is
 * a raised card like the sidebar's current row. + and ··· show on hover and keyboard focus, and
 * a right-click opens the ··· menu.
 */
export function PageTreeRow({
  item,
  href,
  indentStart,
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
  const indent = indentOf(item.depth, indentStart);
  return (
    <div
      role="treeitem"
      id={`tree-${item.id}`}
      data-tree-id={item.id}
      aria-labelledby={`tree-${item.id}-title`}
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
      onContextMenu={(event) => {
        const trigger = event.currentTarget.querySelector<HTMLButtonElement>(`[${ROW_MENU}]`);
        if (!trigger || renaming) return;
        event.preventDefault();
        trigger.click();
      }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      style={{ paddingLeft: indent }}
      className={cx(
        'group/row relative flex h-7 cursor-pointer items-center gap-1.5 rounded-control pr-1 text-13 whitespace-nowrap select-none',
        active ? 'bg-card font-medium text-tx shadow-e1' : 'text-tx-2 hover:bg-hover hover:text-tx',
        drop === 'inside' && 'bg-acc-50 shadow-[inset_0_0_0_1px_var(--acc)]',
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
            'pointer-events-none absolute right-1 z-10 h-0.5 rounded-full bg-acc',
            drop === 'before' ? '-top-px' : '-bottom-px',
          )}
        >
          <span className="absolute -top-0.75 -left-1 size-2 rounded-full border-2 border-acc bg-side" />
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
          'grid size-4.5 shrink-0 place-items-center rounded-chip text-tx-3',
          item.hasChildren && 'hover:bg-hover hover:text-tx',
        )}
      >
        {item.loading ? (
          <Spinner size={10} />
        ) : item.hasChildren ? (
          <Icon
            name="chevron"
            size={13}
            className={cx(
              'motion-safe:transition-transform motion-safe:duration-150',
              item.expanded && 'rotate-90',
            )}
          />
        ) : null}
      </span>
      <PageIcon value={item.icon} size={15} className={active ? 'text-tx-2' : 'text-tx-3'} />
      {renaming ? (
        <RenameField title={item.title} onRename={onRename} onCancel={onRenameCancel} />
      ) : (
        <a
          id={`tree-${item.id}-title`}
          href={href}
          tabIndex={-1}
          draggable={false}
          onClick={(event) => event.preventDefault()}
          className="min-w-0 flex-1 truncate text-inherit no-underline hover:text-inherit"
        >
          {item.title || <span className="text-tx-3">Untitled</span>}
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
