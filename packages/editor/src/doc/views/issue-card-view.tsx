import { Icon } from '@bemmoly/ui/icons';
import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { cx } from '../../cx.ts';
import type { SuggestionItem } from '../../types.ts';
import { useDocServices } from '../context.ts';
import type { NodeViewProps, ViewSpec } from '../portals.ts';
import { PLACEHOLDER_CARD, PLACEHOLDER_TITLE } from '../styles.ts';

/*
 * The issue card block: the host's live card (Work's) by key; with Work off, the key on a
 * quiet card so the page still reads. A new card asks for its issue in place, searching as
 * the person types, with ↑↓ and Enter.
 */

function IssuePicker({ onPick }: { onPick: (key: string) => void }) {
  const { searchIssues } = useDocServices();
  const id = useId();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<{ query: string; items: readonly SuggestionItem[] }>({
    query: '',
    items: [],
  });
  const [active, setActive] = useState(0);
  const q = query.trim();
  useEffect(() => {
    if (!q || !searchIssues) return undefined;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      void searchIssues(q, abort.signal)
        .catch(() => [])
        .then((items) => {
          if (!abort.signal.aborted) setRows({ query: q, items });
        });
    }, 150);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [q, searchIssues]);
  const items = q && rows.query === q ? rows.items : [];
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (items.length)
        setActive((active + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = items[Math.min(active, items.length - 1)];
      if (item) onPick(item.id);
    }
  };
  return (
    <div className={cx(PLACEHOLDER_CARD, 'gap-2')}>
      <span className={PLACEHOLDER_TITLE}>Issue card</span>
      <input
        autoFocus
        role="combobox"
        aria-label="Find an issue"
        aria-expanded={items.length > 0}
        aria-controls={`${id}-list`}
        placeholder="Type a key or a title"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        className="h-8 rounded-card border border-line bg-card px-2.5 font-sans text-13 text-tx outline-0 focus:border-acc"
      />
      {items.length > 0 && (
        <div id={`${id}-list`} role="listbox" aria-label="Issues" className="flex flex-col">
          {items.map((item, index) => (
            <div
              key={item.id}
              role="option"
              aria-selected={index === active}
              onPointerMove={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick(item.id)}
              className={cx(
                'flex h-8 cursor-pointer items-center gap-2 rounded-chip px-2 text-13 text-tx',
                index === active && 'bg-hover',
              )}
            >
              <span className="font-mono text-12 text-tx-3">{item.label}</span>
              <span className="truncate">{item.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The card itself: the host's live one, or the key on a quiet card. */
export function IssueCardBlock({ issueKey: key }: { issueKey: string }) {
  const { renderIssueCard } = useDocServices();
  if (renderIssueCard && key) return <>{renderIssueCard(key)}</>;
  return (
    <div className={PLACEHOLDER_CARD}>
      <span className="flex items-center gap-2">
        <Icon name="board" size={14} className="text-tx-3" />
        <span className="font-mono text-12">{key || 'No issue chosen'}</span>
      </span>
      <span className="text-12 text-tx-3">Live details appear here when Work is enabled.</span>
    </div>
  );
}

function IssueCardChrome({ node, editor, updateAttributes }: NodeViewProps) {
  const key = String(node.attrs['key'] ?? '');
  if (!key && editor.isEditable)
    return <IssuePicker onPick={(next) => updateAttributes({ key: next })} />;
  return <IssueCardBlock issueKey={key} />;
}

export const issueCardView: ViewSpec = {
  tag: 'div',
  className: () => 'min-w-0',
  attrs: (node) => ({ 'data-type': 'issueCard', 'data-key': String(node.attrs['key'] ?? '') }),
  Component: IssueCardChrome,
};
