import { Fragment, useEffect, useRef } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { FloatingLayer } from '../../lib/floating.tsx';
import { Spinner } from '../spinner/spinner.tsx';
import type { SelectOption } from './types.ts';
import type { SelectState } from './use-select.ts';

/** The popover is the trigger's width, never narrower than this. */
const MIN_WIDTH = 200;

interface SelectListProps {
  state: SelectState;
  label: string | undefined;
  labelledBy: string;
  searchPlaceholder: string;
}

function SearchBox({ state, placeholder }: { state: SelectState; placeholder: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-br2 px-2.5">
      <Icon name="search" className="text-tx5" />
      <input
        ref={ref}
        type="text"
        role="combobox"
        aria-label={placeholder}
        aria-expanded
        aria-controls={state.listId}
        aria-autocomplete="list"
        aria-activedescendant={state.active >= 0 ? state.optionId(state.active) : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={state.query}
        onChange={(event) => state.setQuery(event.target.value)}
        onKeyDown={state.onKeyDown}
        className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-13 text-tx outline-0 placeholder:text-tx5"
      />
      {state.remote.loading && <Spinner label="Searching" className="text-tx5" />}
    </div>
  );
}

function OptionRow({
  state,
  option,
  index,
}: {
  state: SelectState;
  option: SelectOption;
  index: number;
}) {
  const selected = option.value === state.value;
  const active = index === state.active;
  return (
    <div
      id={state.optionId(index)}
      role="option"
      aria-selected={selected}
      aria-disabled={option.disabled || undefined}
      onMouseDown={(event) => event.preventDefault()}
      onPointerMove={() => !option.disabled && !active && state.setActiveValue(option.value)}
      onClick={() => state.choose(option)}
      className={cx(
        'flex shrink-0 cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-13',
        active ? 'bg-ac-bg font-medium text-ac' : 'text-tx',
        'aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
      )}
    >
      {option.icon && (
        <span aria-hidden className="inline-flex shrink-0">
          {option.icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate">{option.label}</span>
        {option.description && (
          <span className="truncate text-12 font-normal text-tx5">{option.description}</span>
        )}
      </span>
      {selected && <Icon name="check" className="shrink-0 text-ac" />}
    </div>
  );
}

function emptyText(state: SelectState): string {
  if (state.remote.loading) return 'Searching…';
  if (state.remote.failed) return 'Search is unavailable right now. Try again.';
  return 'No matches';
}

/**
 * The Select's popover, drawn as the Doc Editor menu: 8px radius, br border, shadow-menu, 6px
 * padding, 8px 10px items with the active one in accent on ac-bg. The chosen option carries a
 * tick. Group labels are the menu's 11px capitals.
 */
export function SelectList({ state, label, labelledBy, searchPlaceholder }: SelectListProps) {
  const { view } = state;
  const listRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const { anchor, close } = state;
  const activeId = state.active >= 0 ? state.optionId(state.active) : null;

  useEffect(() => {
    if (!activeId) return;
    listRef.current?.querySelector(`[id="${activeId}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!layerRef.current?.contains(target) && !anchor?.contains(target)) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [anchor, close]);

  const starts = view.sections.map((_, i) =>
    view.sections.slice(0, i).reduce((sum, section) => sum + section.options.length, 0),
  );
  return (
    <FloatingLayer
      ref={layerRef}
      anchor={anchor}
      matchWidth={MIN_WIDTH}
      className="overflow-hidden"
      data-select-popover=""
    >
      {state.searchOn && <SearchBox state={state} placeholder={searchPlaceholder} />}
      <div
        ref={listRef}
        id={state.listId}
        role="listbox"
        aria-label={label}
        aria-labelledby={label ? undefined : labelledBy}
        className="flex max-h-80 min-h-0 flex-col overflow-y-auto p-1.5"
      >
        {view.flat.length === 0 && (
          <div role="presentation" className="px-2.5 py-2 text-13 text-tx5">
            {emptyText(state)}
          </div>
        )}
        {view.sections.map((section, sectionIndex) => {
          const rows = section.options.map((option, i) => (
            <OptionRow
              key={option.value}
              state={state}
              option={option}
              index={starts[sectionIndex]! + i}
            />
          ));
          if (!section.label) return <Fragment key={`section-${sectionIndex}`}>{rows}</Fragment>;
          const headingId = `${state.listId}-group-${sectionIndex}`;
          return (
            <div
              key={`section-${sectionIndex}`}
              role="group"
              aria-labelledby={headingId}
              className="flex flex-col"
            >
              <div
                id={headingId}
                role="presentation"
                className={cx(
                  'px-2.5 py-1.5 text-11 font-medium tracking-caps text-tx5 uppercase',
                  sectionIndex > 0 && 'mt-1 border-t border-br-row',
                )}
              >
                {section.label}
              </div>
              {rows}
            </div>
          );
        })}
      </div>
      {view.total > view.shown && (
        <div className="shrink-0 border-t border-br2 px-3 py-2 text-12 text-tx5">
          Showing {view.shown} of {view.total} · type to narrow
        </div>
      )}
    </FloatingLayer>
  );
}
