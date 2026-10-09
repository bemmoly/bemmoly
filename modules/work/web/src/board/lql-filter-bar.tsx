import { IconButton, Input } from '@bemmoly/ui';
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  checkLql,
  completeLql,
  insertSuggestion,
  type LqlValueSources,
} from '../hooks/board-lql.ts';
import { cls } from './board-context.ts';

export interface LqlFilterBarProps {
  /** The query the board is filtered by now. */
  applied: string;
  onApply(query: string): void;
  onClose(): void;
  sources: LqlValueSources;
  /** The server's word on an applied query it could not run, e.g. an unknown status name. */
  serverError?: string | null;
}

/**
 * The board's LQL bar: the search box widened to take a query, checked as it is typed and
 * completed at the cursor. Enter applies a valid query; problems are named under the box with
 * where they are, and nothing is sent until the query parses.
 */
export function LqlFilterBar({
  applied,
  onApply,
  onClose,
  sources,
  serverError,
}: LqlFilterBarProps) {
  const [draft, setDraft] = useState(applied);
  const [cursor, setCursor] = useState(applied.length);
  const [active, setActive] = useState(0);
  const [listOpen, setListOpen] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const error = useMemo(() => checkLql(draft), [draft]);
  const list = useMemo(() => completeLql(draft, cursor, sources), [draft, cursor, sources]);
  const showList = listOpen && list.items.length > 0;
  const message = error
    ? `${error.message} (at character ${error.position + 1}).`
    : draft.trim() === applied && serverError
      ? serverError
      : null;

  const pick = (index: number) => {
    const suggestion = list.items[index];
    if (!suggestion) return;
    const next = insertSuggestion(draft, list, suggestion);
    setDraft(next.text);
    setCursor(next.cursor);
    setActive(0);
    requestAnimationFrame(() => input.current?.setSelectionRange(next.cursor, next.cursor));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (showList && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((list.items.length + active + step) % list.items.length);
    } else if (showList && event.key === 'Tab') {
      event.preventDefault();
      pick(active);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (!error) {
        onApply(draft);
        setListOpen(false);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (showList) setListOpen(false);
      else onClose();
    }
  };

  return (
    <div className="relative w-105 shrink-0">
      <Input
        ref={input}
        autoFocus
        mono
        role="combobox"
        aria-label="Filter with LQL"
        aria-expanded={showList}
        aria-controls={listId}
        aria-invalid={Boolean(message)}
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        placeholder='status = "In progress" AND assignee = me'
        value={draft}
        spellCheck={false}
        onChange={(event) => {
          setDraft(event.target.value);
          setCursor(event.target.selectionStart ?? event.target.value.length);
          setActive(0);
          setListOpen(true);
        }}
        onSelect={(event) => setCursor(event.currentTarget.selectionStart ?? 0)}
        onKeyDown={onKeyDown}
        onBlur={() => setListOpen(false)}
        onFocus={() => setListOpen(true)}
        prefix={<span className="font-mono text-11 font-medium text-ac">LQL</span>}
        suffix={
          <IconButton
            label="Close the LQL filter"
            icon="close"
            size="xs"
            className="-mr-1.5 size-6"
            onClick={() => {
              onApply('');
              onClose();
            }}
          />
        }
        wrapperClassName={cls(message && 'border-warn')}
      />
      <div className="absolute top-full left-0 z-20 mt-1 flex w-full flex-col gap-1">
        {message && (
          <p
            role="alert"
            className="m-0 rounded-sm border border-warn bg-warn-bg px-2 py-1 text-11 text-warn-fg"
          >
            {message}
          </p>
        )}
        {showList && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Suggestions"
            className="m-0 flex list-none flex-col rounded-card border border-br bg-sf p-1 shadow-menu"
          >
            {list.items.map((item, index) => (
              <li
                key={`${item.kind}-${item.text}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(index);
                }}
                className={cls(
                  'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-12h',
                  index === active ? 'bg-ac-bg text-ac' : 'text-tx2',
                )}
              >
                <span className="font-mono">{item.label}</span>
                {item.detail && <span className="ml-auto text-11 text-tx5">{item.detail}</span>}
                <span className="text-10 tracking-label text-tx6 uppercase">{item.kind}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
