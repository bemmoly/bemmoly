import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cx } from '../../lib/cx.ts';
import { IconButton } from '../button/icon-button.tsx';
import { Menu } from '../menu/menu.tsx';
import { PageTreeRow } from './page-tree-row.tsx';
import {
  focusForKey,
  moveForKey,
  rowForLetter,
  type KeyboardMove,
  type PageTreeItem,
  type PageTreeMove,
} from './tree-model.ts';
import { useTreeDrag } from './use-tree-drag.ts';

export interface PageTreeOpenEvent {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}

export interface PageTreeProps {
  /** The rows to show, in reading order: open pages are followed by their children. */
  items: readonly PageTreeItem[];
  /** The tree's accessible name, e.g. "Pages in Engineering". */
  label: string;
  activeId?: string | null;
  hrefOf: (item: PageTreeItem) => string;
  onOpen: (item: PageTreeItem, event: PageTreeOpenEvent) => void;
  onToggle: (item: PageTreeItem, expanded: boolean) => void;
  /** Drag and Alt+arrow moves; without it the tree is read-only in order. */
  onMove?: (move: PageTreeMove) => void;
  /** The + on a hovered row. */
  onAddChild?: (item: PageTreeItem) => void;
  /** The items of a row's ··· menu (MenuItem elements). */
  menu?: (item: PageTreeItem) => ReactNode;
  renamingId?: string | null;
  /** F2 on a row. */
  onRenameStart?: (item: PageTreeItem) => void;
  onRename?: (item: PageTreeItem, title: string) => void;
  onRenameCancel?: () => void;
  /** Below the rows: "Show more", a loading line. */
  footer?: ReactNode;
  className?: string;
}

const MOVE_KEYS: Record<string, KeyboardMove> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowRight: 'indent',
  ArrowLeft: 'outdent',
};

const rowElement = (root: HTMLElement | null, id: string) =>
  root?.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(id)}"]`) ?? null;

/**
 * A space's pages as a WAI-ARIA tree. Arrows walk and open rows, Enter opens a page, F2
 * renames, a letter jumps to the next title that starts with it, Alt+arrows move the page
 * (the keyboard way to do what dragging does). Rows can be dragged above, below or into
 * another row; the owner applies the move, optimistically, and rolls back on failure.
 */
export function PageTree({
  items,
  label,
  activeId = null,
  hrefOf,
  onOpen,
  onToggle,
  onMove,
  onAddChild,
  menu,
  renamingId = null,
  onRenameStart,
  onRename,
  onRenameCancel,
  footer,
  className,
}: PageTreeProps) {
  const root = useRef<HTMLDivElement>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const expand = useCallback((item: PageTreeItem) => onToggle(item, true), [onToggle]);
  const drag = useTreeDrag(items, onMove, expand);

  const tabbableId =
    (focusId && items.some((item) => item.id === focusId) ? focusId : null) ??
    (activeId && items.some((item) => item.id === activeId) ? activeId : null) ??
    items[0]?.id ??
    null;

  const focusRow = useCallback((id: string) => {
    setFocusId(id);
    pendingFocus.current = id;
    rowElement(root.current, id)?.focus();
  }, []);

  // A row moved by the keyboard re-renders in its new place; keep focus on it.
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    const row = rowElement(root.current, id);
    if (row && document.activeElement !== row && root.current?.contains(document.activeElement)) {
      row.focus();
    }
  }, [items]);

  // When a rename ends, focus goes back to its row rather than to the page body.
  const wasRenaming = useRef<string | null>(null);
  useEffect(() => {
    if (wasRenaming.current && !renamingId) rowElement(root.current, wasRenaming.current)?.focus();
    wasRenaming.current = renamingId;
  }, [renamingId]);

  const onKeyDown = (item: PageTreeItem) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const moveKey = MOVE_KEYS[event.key];
    if (event.altKey && moveKey && onMove) {
      event.preventDefault();
      const move = moveForKey(items, item.id, moveKey);
      if (move) {
        pendingFocus.current = item.id;
        onMove(move);
      }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      onOpen(item, event);
      return;
    }
    if (event.key === 'F2' && onRenameStart) {
      event.preventDefault();
      onRenameStart(item);
      return;
    }
    const step = focusForKey(items, item.id, event.key);
    if (step) {
      event.preventDefault();
      if (step.toggle !== undefined) onToggle(item, step.toggle);
      if (step.focus) focusRow(step.focus);
      return;
    }
    if (event.key.length === 1 && /\S/.test(event.key) && !event.metaKey && !event.ctrlKey) {
      const next = rowForLetter(items, item.id, event.key);
      if (next) focusRow(next);
    }
  };

  const actionsFor = (item: PageTreeItem, inTabOrder: boolean) =>
    onAddChild || menu ? (
      <>
        {onAddChild && (
          <IconButton
            label={`Add a page inside ${item.title || 'Untitled'}`}
            icon="plus"
            size="xs"
            variant="ghost"
            className="size-5.5"
            tabIndex={inTabOrder ? 0 : -1}
            onClick={() => onAddChild(item)}
          />
        )}
        {menu && (
          <Menu
            align="start"
            widthClassName="w-52"
            trigger={(props) => (
              <IconButton
                {...props}
                label={`Actions for ${item.title || 'Untitled'}`}
                icon="more"
                size="xs"
                variant="ghost"
                className="size-5.5"
                tabIndex={inTabOrder ? 0 : -1}
              />
            )}
          >
            {menu(item)}
          </Menu>
        )}
      </>
    ) : undefined;

  return (
    <div
      ref={root}
      role="tree"
      aria-label={label}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) drag.end();
      }}
      className={cx('flex flex-col gap-px', className)}
    >
      {items.map((item) => (
        <PageTreeRow
          key={item.id}
          item={item}
          href={hrefOf(item)}
          active={item.id === activeId}
          tabbable={item.id === tabbableId}
          dragging={drag.dragId === item.id}
          drop={drag.zoneFor(item.id)}
          renaming={item.id === renamingId}
          actions={actionsFor(item, item.id === tabbableId)}
          draggable={Boolean(onMove)}
          onToggle={() => onToggle(item, !item.expanded)}
          onOpen={(event) => {
            setFocusId(item.id);
            onOpen(item, event);
          }}
          onKeyDown={onKeyDown(item)}
          onFocus={() => setFocusId(item.id)}
          onRename={(title) => onRename?.(item, title)}
          onRenameCancel={() => onRenameCancel?.()}
          onDragStart={(event) => drag.start(item, event)}
          onDragOver={(event) => drag.over(item, event)}
          onDragEnd={drag.end}
          onDrop={(event) => drag.drop(item, event)}
        />
      ))}
      {footer}
    </div>
  );
}
