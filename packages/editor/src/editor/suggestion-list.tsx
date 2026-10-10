import { Kbd } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../cx.ts';
import type { OpenSuggestion, SuggestionRow, SuggestionStore } from './suggestion-store.ts';

const HINTS: Record<OpenSuggestion['kind'], string> = {
  mention: 'Type a name',
  reference: 'Type a key or a title',
  slash: 'No blocks match',
};

function emptyText(open: OpenSuggestion): string {
  if (open.loading) return 'Searching…';
  if (open.failed) return 'Search is unavailable right now. Try again.';
  const q = open.query.trim();
  if (open.kind === 'slash' && q) return `No block called “${q}”. Try Table or Heading.`;
  return q ? 'No matches' : HINTS[open.kind];
}

/** Rows in order, with each group's label before its first row. */
function sections(items: readonly SuggestionRow[]) {
  const out: Array<{ label: string | undefined; rows: Array<{ row: SuggestionRow; at: number }> }> =
    [];
  items.forEach((row, at) => {
    const last = out[out.length - 1];
    if (last && last.label === row.group) last.rows.push({ row, at });
    else out.push({ label: row.group, rows: [{ row, at }] });
  });
  return out;
}

export const optionId = (listId: string, index: number) => `${listId}-option-${index}`;

/** A / menu row: the block's tile, its name and line, and the Markdown that makes it. */
function BlockRow({ row, active }: { row: SuggestionRow; active: boolean }) {
  const ai = row.tone === 'ai';
  return (
    <>
      <span
        aria-hidden
        className={cx(
          'grid size-8 place-items-center rounded-card shadow-[inset_0_0_0_1px_var(--line)]',
          ai ? 'bg-ai-50 text-ai-600' : 'bg-canvas text-tx-2',
        )}
      >
        <Icon name={row.icon ?? 'text'} size={17} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span
          data-label=""
          className={cx('truncate leading-tight font-[550]', ai && 'text-ai-600')}
        >
          {row.label}
        </span>
        {row.description && (
          <span className="truncate text-12 leading-snug text-tx-3">{row.description}</span>
        )}
      </span>
      {row.hint ? <Kbd keys={row.hint} className={active ? 'text-tx-2' : undefined} /> : <span />}
    </>
  );
}

/** A people, page or issue row: its name and a second line. */
function PlainRow({ row }: { row: SuggestionRow }) {
  return (
    <>
      <span data-label="" className="truncate">
        {row.label}
      </span>
      {row.description && <span className="truncate text-12 text-tx-3">{row.description}</span>}
    </>
  );
}

/**
 * The open @, # or / list. The / menu draws the Docs review's Writing tab: 372px, a tile, a
 * name and a line per row, the Markdown shortcut at the end, sentence-case group labels and a
 * footer that teaches the keys and counts the blocks behind the filter. Focus stays in the
 * text; the editor points at the active row with aria-activedescendant.
 */
export function SuggestionList({
  store,
  listId,
  page = false,
}: {
  store: SuggestionStore;
  listId: string;
  /** On a Docs page the menu takes the page's measures. */
  page?: boolean;
}) {
  const open = useSyncExternalStore(store.subscribe, store.get);
  const activeId = open && open.items.length > 0 ? optionId(listId, open.active) : null;

  useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);

  if (!open) return null;
  const blocks = open.kind === 'slash' && page;
  return createPortal(
    <div
      // Focus stays in the text, even for a click on a label or the scrollbar.
      onMouseDown={(event) => event.preventDefault()}
      className={cx(
        'flex flex-col overflow-hidden rounded-dialog bg-card text-13 text-tx shadow-e2 motion-safe:animate-pop-in',
        blocks ? 'w-93' : 'w-80',
      )}
    >
      <div
        id={listId}
        role="listbox"
        aria-label={open.label}
        style={{ maxHeight: page ? 'var(--list-max, 340px)' : undefined }}
        className={cx('flex flex-col overflow-y-auto p-1.5', !page && 'max-h-80')}
      >
        {sections(open.items).map((section, index) => (
          <div
            key={`${section.label ?? ''}-${index}`}
            role="group"
            aria-label={section.label}
            className="flex flex-col"
          >
            {section.label && (
              <div role="presentation" className="px-2.5 pt-2 pb-1 text-11 font-semibold text-tx-3">
                {section.label}
              </div>
            )}
            {section.rows.map(({ row, at }) => {
              const active = at === open.active;
              return (
                <div
                  key={`${row.id}-${at}`}
                  id={optionId(listId, at)}
                  role="option"
                  aria-selected={active}
                  onMouseDown={(event) => event.preventDefault()}
                  onPointerMove={() => store.setActive(at)}
                  onClick={() => store.choose(at)}
                  className={cx(
                    'shrink-0 cursor-pointer rounded-card',
                    blocks
                      ? 'grid h-11.5 grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2.5 pr-2.5 pl-1.75'
                      : 'flex flex-col gap-0.5 px-2.5 py-2',
                    active && 'bg-hover',
                  )}
                >
                  {blocks ? <BlockRow row={row} active={active} /> : <PlainRow row={row} />}
                </div>
              );
            })}
          </div>
        ))}
        {open.items.length === 0 && (
          <div role="presentation" className="px-2.5 py-2 text-13 text-tx-3">
            {emptyText(open)}
          </div>
        )}
      </div>
      {blocks && (
        <div
          role="presentation"
          className="flex h-8.5 shrink-0 items-center gap-3 border-t border-line bg-sunken px-3 text-11 text-tx-3"
        >
          <span className="inline-flex items-center gap-1.25">
            <Kbd keys="Up Down" />
            move
          </span>
          <span className="inline-flex items-center gap-1.25">
            <Kbd keys="Enter" />
            insert
          </span>
          <span className="inline-flex items-center gap-1.25">
            <Kbd keys="Esc" />
            close
          </span>
          <span className="ml-auto tabular-nums">
            {open.items.length} {open.items.length === 1 ? 'block' : 'blocks'}
          </span>
        </div>
      )}
    </div>,
    open.element,
  );
}
