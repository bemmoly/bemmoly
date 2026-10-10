import { Icon, type IconName } from '@bemmoly/ui/icons';
import type { Editor } from '@tiptap/core';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { cx } from '../cx.ts';
import { applyLink, normalizeHref } from '../editor/link-form.tsx';
import type { SuggestionItem } from '../types.ts';
import { SAFE_HREF } from '../view.tsx';
import type { DocServices } from './services.ts';

/*
 * ⌘K over the page: one field that takes an address or searches pages and issues. A page
 * links the selected words to it (or, with nothing selected, drops in a page link); an issue
 * does the same with its address, or embeds the issue where nothing is selected. Enter takes
 * the active row, or the address as typed when no row is active.
 */

interface Choice {
  kind: 'url' | 'page' | 'issue' | 'remove';
  id: string;
  label: string;
  description?: string;
  href?: string;
}

const ICONS: Record<Choice['kind'], IconName> = {
  url: 'link',
  page: 'page',
  issue: 'subtask',
  remove: 'unlink',
};

interface Results {
  query: string;
  pages: SuggestionItem[];
  issues: SuggestionItem[];
}

/** Pages and issues for what is typed; rows for an older query never show. */
function useResults(query: string, services: DocServices) {
  const [rows, setRows] = useState<Results>({ query: '', pages: [], issues: [] });
  const q = query.trim();
  const searchable = q.length > 0 && !SAFE_HREF.test(q);
  useEffect(() => {
    if (!searchable) return undefined;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      const safe = (search?: DocServices['searchPages']) =>
        search ? search(q, abort.signal).catch(() => []) : Promise.resolve([]);
      void Promise.all([safe(services.searchPages), safe(services.searchIssues)]).then(
        ([pages, issues]) => {
          if (!abort.signal.aborted)
            setRows({ query: q, pages: [...pages].slice(0, 5), issues: [...issues].slice(0, 5) });
        },
      );
    }, 150);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [q, searchable, services]);
  return searchable && rows.query === q ? rows : { pages: [], issues: [] };
}

function choose(editor: Editor, services: DocServices, choice: Choice) {
  const { empty } = editor.state.selection;
  if (choice.kind === 'remove') return applyLink(editor, '');
  if (choice.kind === 'url') return applyLink(editor, normalizeHref(choice.id));
  if (choice.kind === 'page') {
    const href = services.pageHref?.(choice.id);
    if (empty || !href) {
      editor
        .chain()
        .focus()
        .insertContent([
          { type: 'pageLink', attrs: { pageId: choice.id, title: choice.label } },
          { type: 'text', text: ' ' },
        ])
        .run();
      return undefined;
    }
    return applyLink(editor, href);
  }
  if (empty || !choice.href) {
    editor.chain().focus().insertIssueEmbed(choice.id).run();
    return undefined;
  }
  return applyLink(editor, choice.href);
}

export interface LinkPickerProps {
  editor: Editor;
  services: DocServices;
  /** Closes the picker; focus goes back to the text. */
  onDone: () => void;
}

export function LinkPicker({ editor, services, onDone }: LinkPickerProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const linked = editor.isActive('link');
  const [query, setQuery] = useState(() => String(editor.getAttributes('link')['href'] ?? ''));
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { pages, issues } = useResults(query, services);

  const typed = query.trim();
  const choices: Choice[] = [
    ...(typed && (SAFE_HREF.test(normalizeHref(typed)) || /[./]/.test(typed))
      ? [{ kind: 'url' as const, id: typed, label: `Link to ${normalizeHref(typed)}` }]
      : []),
    ...pages.map((row) => ({ kind: 'page' as const, ...row })),
    ...issues.map((row) => ({ kind: 'issue' as const, ...row })),
    ...(linked ? [{ kind: 'remove' as const, id: 'remove', label: 'Remove link' }] : []),
  ];
  const current = choices[Math.min(active, choices.length - 1)];

  useEffect(() => input.current?.select(), []);

  const take = (choice: Choice | undefined) => {
    if (!choice) return;
    if (choice.kind === 'url' && !SAFE_HREF.test(normalizeHref(choice.id))) {
      setError('Links start with https://, mailto: or /.');
      return;
    }
    choose(editor, services, choice);
    onDone();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      if (choices.length) setActive((active + step + choices.length) % choices.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      take(current);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onDone();
      editor.commands.focus();
    }
  };

  return (
    <div className="flex w-90 flex-col" role="dialog" aria-label="Link">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <Icon name="link" size={15} className="text-tx-3" />
        <input
          ref={input}
          aria-label="Link address or page"
          role="combobox"
          aria-expanded={choices.length > 0}
          aria-controls={`${id}-list`}
          aria-activedescendant={current ? `${id}-${choices.indexOf(current)}` : undefined}
          aria-invalid={error ? true : undefined}
          placeholder="Paste a link, or search pages and issues"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setError(null);
          }}
          onKeyDown={onKeyDown}
          className="h-7 min-w-0 flex-1 border-0 bg-transparent font-sans text-13 text-tx outline-0 placeholder:text-tx-3"
        />
      </div>
      {error && (
        <p role="alert" className="m-0 px-3 pb-2 text-12 text-danger">
          {error}
        </p>
      )}
      {choices.length > 0 && (
        <div
          id={`${id}-list`}
          role="listbox"
          aria-label="Link to"
          className="flex flex-col border-t border-line p-1"
        >
          {choices.map((choice, index) => (
            <div
              key={`${choice.kind}-${choice.id}`}
              id={`${id}-${index}`}
              role="option"
              aria-selected={choice === current}
              onPointerMove={() => setActive(index)}
              onClick={() => take(choice)}
              className={cx(
                'flex h-8 cursor-pointer items-center gap-2.5 rounded-sm px-2 text-13',
                choice === current ? 'bg-hover text-tx' : 'text-tx-2',
                choice.kind === 'remove' && 'text-danger',
              )}
            >
              <Icon name={ICONS[choice.kind]} size={15} className="shrink-0 text-tx-3" />
              <span className="min-w-0 flex-1 truncate">
                {choice.kind === 'issue' ? (
                  <>
                    <span className="mr-1.5 font-mono text-12 text-tx-3">{choice.label}</span>
                    {choice.description}
                  </>
                ) : (
                  choice.label
                )}
              </span>
              {choice.kind === 'page' && choice.description && (
                <span className="shrink-0 text-12 text-tx-3">{choice.description}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
