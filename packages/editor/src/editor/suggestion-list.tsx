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
  return open.query.trim() ? 'No matches' : HINTS[open.kind];
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

/**
 * The open @, # or / list, drawn as the Doc Editor mock's menu: 320px, 8px radius, br border,
 * shadow-menu, 6px padding, 8px 10px rows with the active one in accent on ac-bg, and group
 * labels in the menu's 11px capitals. Focus stays in the text; the editor points at the active
 * row with aria-activedescendant.
 */
export function SuggestionList({
  store,
  listId,
  page = false,
}: {
  store: SuggestionStore;
  listId: string;
  /** On a Docs page the menu takes the page's 1.7 line height, as the mock's does. */
  page?: boolean;
}) {
  const open = useSyncExternalStore(store.subscribe, store.get);
  const activeId = open && open.items.length > 0 ? optionId(listId, open.active) : null;

  useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);

  if (!open) return null;
  return createPortal(
    <div
      id={listId}
      role="listbox"
      aria-label={open.label}
      className={cx(
        'flex w-80 flex-col overflow-y-auto rounded-card border border-br bg-sf p-1.5 text-13 text-tx shadow-menu',
        page ? 'max-h-85 leading-prose' : 'max-h-80',
      )}
    >
      {sections(open.items).map((section, index) => (
        <div
          key={`${section.label ?? ''}-${index}`}
          role="group"
          aria-label={section.label}
          className="flex flex-col"
        >
          {section.label && (
            <div
              role="presentation"
              className={cx(
                'px-2.5 py-1.5 text-11 font-medium tracking-caps text-tx5 uppercase',
                index > 0 && 'mt-1 border-t border-br-row',
              )}
            >
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
                  'flex shrink-0 cursor-pointer flex-col gap-0.5 rounded-sm px-2.5 py-2',
                  active ? 'bg-ac-bg font-medium text-ac' : 'text-tx',
                )}
              >
                <span className="truncate">{row.label}</span>
                {row.description && (
                  <span className="truncate text-12 font-normal text-tx5">{row.description}</span>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {open.items.length === 0 && (
        <div role="presentation" className="px-2.5 py-2 text-13 text-tx5">
          {emptyText(open)}
        </div>
      )}
    </div>,
    open.element,
  );
}
