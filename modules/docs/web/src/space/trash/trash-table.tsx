import type { TrashItem } from '@bemmoly/module-docs/shared';
import { Avatar, Button, IconButton, Menu, MenuItem, RelativeTime } from '@bemmoly/ui';
import { Icon, PageIcon } from '@bemmoly/ui/icons';
import type { KeyboardEvent } from 'react';
import { cx } from '../../page/cx.ts';
import { pageTitle } from './use-trash.ts';

export interface TrashTableProps {
  pages: readonly TrashItem[];
  spaceName: string;
  selectedId: string | null;
  canPurge: boolean;
  restoringId: string | null;
  onPreview: (page: TrashItem) => void;
  onRestore: (page: TrashItem) => void;
  onDeleteForever: (page: TrashItem) => void;
}

const HEAD = 'px-3 py-2 text-left text-12 font-medium text-tx-3';
const CELL = 'px-3 py-2.5 align-middle';

/**
 * Page, where it was, who deleted it and when. A row previews on click or Enter; Restore and
 * ··· show on hover and on keyboard focus, and stay visible on touch. R restores the focused
 * row and ⌘⌫ asks to delete it forever.
 */
export function TrashTable(props: TrashTableProps) {
  const { pages, spaceName, selectedId, canPurge, restoringId } = props;

  const onRowKey = (event: KeyboardEvent<HTMLTableRowElement>, page: TrashItem, at: number) => {
    if (event.target !== event.currentTarget) return;
    const rows = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('tr');
    const move = (step: number) => {
      event.preventDefault();
      rows?.[Math.min(pages.length - 1, Math.max(0, at + step))]?.focus();
    };
    if (event.key === 'ArrowDown' || event.key === 'j') move(1);
    else if (event.key === 'ArrowUp' || event.key === 'k') move(-1);
    else if (event.key === 'Enter') props.onPreview(page);
    else if (event.key === 'r' && !event.metaKey && !event.ctrlKey) props.onRestore(page);
    else if (event.key === 'Backspace' && (event.metaKey || event.ctrlKey) && canPurge) {
      event.preventDefault();
      props.onDeleteForever(page);
    }
  };

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-card">
      <table className="w-full border-collapse text-13">
        <thead className="border-b border-line">
          <tr>
            <th className={HEAD}>Page</th>
            <th className={cx(HEAD, 'hidden md:table-cell')}>Was in</th>
            <th className={cx(HEAD, 'hidden sm:table-cell')}>Deleted by</th>
            <th className={HEAD}>When</th>
            <th className={HEAD}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {pages.map((page, at) => (
            <tr
              key={page.id}
              tabIndex={0}
              aria-selected={page.id === selectedId}
              onClick={() => props.onPreview(page)}
              onKeyDown={(event) => onRowKey(event, page, at)}
              className={cx(
                'group cursor-pointer border-b border-line-2 whitespace-nowrap outline-0 last:border-b-0',
                'hover:bg-side focus-visible:bg-side focus-visible:shadow-[inset_2px_0_0_var(--color-ac)]',
                page.id === selectedId && 'bg-side shadow-[inset_2px_0_0_var(--color-ac)]',
              )}
            >
              <td className={CELL}>
                <span className="flex min-w-0 items-center gap-2.5">
                  <PageIcon value={page.icon} size={16} className="shrink-0 text-tx-3" />
                  <span className="truncate font-medium text-tx">{pageTitle(page)}</span>
                  {page.pagesInside > 0 && (
                    <span className="shrink-0 text-12 text-tx-3 tabular-nums">
                      +{page.pagesInside}
                    </span>
                  )}
                </span>
              </td>
              <td className={cx(CELL, 'hidden text-tx-2 md:table-cell')}>
                <span className="flex items-center gap-1.5">
                  {page.wasIn ? (
                    <>
                      <PageIcon value={page.wasIn.icon} size={13} />
                      <span className="max-w-50 truncate">{pageTitle(page.wasIn)}</span>
                    </>
                  ) : (
                    `Top of ${spaceName}`
                  )}
                </span>
              </td>
              <td className={cx(CELL, 'hidden sm:table-cell')}>
                {page.deletedBy ? (
                  <span className="flex items-center gap-1.5 text-tx-2">
                    <Avatar name={page.deletedBy.name} size={18} />
                    {page.deletedBy.name}
                  </span>
                ) : (
                  <span className="text-tx-3">Someone</span>
                )}
              </td>
              <td className={cx(CELL, 'text-tx-3 tabular-nums')}>
                {page.deletedAt && <RelativeTime iso={page.deletedAt} />}
              </td>
              <td
                className={cx(CELL, 'w-40 text-right')}
                onClick={(event) => event.stopPropagation()}
              >
                <span className="inline-flex items-center gap-1 opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 pointer-fine:opacity-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Icon name="undo" size={13} />}
                    loading={restoringId === page.id}
                    onClick={() => props.onRestore(page)}
                  >
                    Restore
                  </Button>
                  {canPurge && (
                    <Menu
                      align="end"
                      trigger={(trigger) => (
                        <IconButton {...trigger} label="More" icon="more" size="sm" />
                      )}
                    >
                      <MenuItem
                        tone="danger"
                        icon={<Icon name="trash" size={14} />}
                        onSelect={() => props.onDeleteForever(page)}
                      >
                        Delete forever
                      </MenuItem>
                    </Menu>
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
