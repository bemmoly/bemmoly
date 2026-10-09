import {
  autocompleteLql,
  formatName,
  type LqlFieldCatalog,
  type LqlSuggestion,
} from '@bemmoly/shared';
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { cx } from '../cx.ts';
import { checkLql } from '../model/lql.ts';

export interface LqlInputProps {
  value: string;
  onChange: (value: string) => void;
  catalog: LqlFieldCatalog;
  /** Values the module knows, by the catalog's provider name: statuses, issueTypes. */
  values?: Readonly<Record<string, readonly string[]>>;
  readOnly?: boolean;
  'aria-label': string;
  placeholder?: string;
  className?: string;
}

const MAX_SUGGESTIONS = 8;

/**
 * An LQL field for the settings lists: mono text as in the mock's lane rows,
 * checked as it is typed with the shared parser and validator, the problem
 * underlined in place, and the shared autocomplete under the cursor.
 */
export function LqlInput({
  value,
  onChange,
  catalog,
  values = {},
  readOnly = false,
  placeholder,
  className,
  ...aria
}: LqlInputProps) {
  const listId = useId();
  const errorId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const error = useMemo(() => (value.trim() ? checkLql(value, catalog) : null), [value, catalog]);

  const completion = useMemo(() => {
    if (cursor === null || readOnly) return null;
    const found = autocompleteLql(value, cursor, catalog);
    const extra: LqlSuggestion[] = found.values
      ? (values[found.values.provider] ?? [])
          .filter((item) => item.toLowerCase().startsWith(found.prefix.toLowerCase()))
          .map((item) => ({ kind: 'value', text: formatName(item), label: item }))
      : [];
    return { ...found, suggestions: [...found.suggestions, ...extra].slice(0, MAX_SUGGESTIONS) };
  }, [cursor, value, catalog, values, readOnly]);
  const suggestions = completion?.suggestions ?? [];
  const open = suggestions.length > 0;

  const pick = (suggestion: LqlSuggestion) => {
    if (!completion) return;
    const { position, length } = completion.replace;
    const before = value.slice(0, position);
    const after = value.slice(position + length);
    const text = `${suggestion.text}${after.startsWith(' ') ? '' : ' '}`;
    const next = `${before}${text}${after}`;
    onChange(next);
    const at = before.length + text.length;
    setCursor(at);
    setActive(0);
    requestAnimationFrame(() => input.current?.setSelectionRange(at, at));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (current + step + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      const chosen = suggestions[active];
      if (!chosen) return;
      event.preventDefault();
      pick(chosen);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setCursor(null);
    }
  };

  const track = () => setCursor(input.current?.selectionStart ?? null);

  return (
    <div className={cx('relative flex min-w-0 flex-col gap-1', className)}>
      <input
        ref={input}
        {...aria}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        spellCheck={false}
        autoComplete="off"
        readOnly={readOnly}
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          setCursor(event.target.selectionStart);
          setActive(0);
        }}
        onKeyUp={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') track();
        }}
        onClick={track}
        onFocus={track}
        onBlur={() => setCursor(null)}
        onKeyDown={onKeyDown}
        className={cx(
          'w-full rounded-sm border bg-sf px-2 py-1.25 font-mono text-12 text-tx2 outline-0',
          error ? 'border-danger' : 'border-br3 focus:border-ac',
        )}
      />
      {error && (
        <span id={errorId} className="text-11h text-danger">
          {error.message}
          {error.expected && error.expected.length > 0 && error.expected.length <= 4 && (
            <span className="text-tx5"> Try {error.expected.join(', ')}.</span>
          )}
        </span>
      )}
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Suggestions"
          className="absolute top-full left-0 z-30 m-0 mt-1 flex max-h-60 min-w-60 list-none flex-col overflow-auto rounded-control border border-br bg-sf p-1 shadow-menu"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion.kind}-${suggestion.label}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                pick(suggestion);
              }}
              onMouseEnter={() => setActive(index)}
              className={cx(
                'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.25 text-12h',
                index === active ? 'bg-ac-bg text-ac' : 'text-tx2',
              )}
            >
              <span className="font-mono">{suggestion.label}</span>
              {suggestion.detail && (
                <span className="ml-auto pl-3 text-11h text-tx5">{suggestion.detail}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
