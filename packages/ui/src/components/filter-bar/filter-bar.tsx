import {
  useRef,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { Icon, type IconName } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { Kbd } from '../kbd/kbd.tsx';

/*
 * The one filter bar Board and Backlog share (docs/design/premium/kit.css, `.tool`): search,
 * the filters that are set as removable chips, Filter and Saved views, then Group and Display
 * on the right. It is presentational; the screen owns the state, which lives in the URL.
 */

export interface FilterChipButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: IconName | ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/** A dashed 26px trigger: Filter, Saved views. */
export function FilterChipButton({
  icon,
  children,
  className,
  type = 'button',
  ...rest
}: FilterChipButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex h-6.5 shrink-0 cursor-pointer items-center gap-1.5 rounded-panel border border-dashed border-line bg-transparent px-2 font-sans text-13 whitespace-nowrap text-tx-2',
        'hover:bg-hover hover:text-tx aria-expanded:bg-hover aria-expanded:text-tx',
        focusRing,
        className,
      )}
      {...rest}
    >
      {typeof icon === 'string' ? <Icon name={icon as IconName} size={14} /> : icon}
      {children}
    </button>
  );
}

export interface AppliedFilter {
  id: string;
  label: ReactNode;
  /** Spoken and shown on hover: "Assignee is Rohan S.". */
  description: string;
  /** An avatar, swatch or glyph before the label. */
  icon?: ReactNode;
  onRemove: () => void;
}

/** A filter that is set: the accent tint with a remove button. */
export function AppliedFilterChip({ filter }: { filter: AppliedFilter }) {
  return (
    <span
      title={filter.description}
      className="inline-flex h-6.5 max-w-60 shrink-0 items-center gap-1.5 rounded-panel border border-acc-100 bg-acc-50 pr-1 pl-2 text-13 whitespace-nowrap text-acc"
    >
      {filter.icon}
      <span className="truncate">{filter.label}</span>
      <button
        type="button"
        onClick={filter.onRemove}
        aria-label={`Remove filter: ${filter.description}`}
        className={cx(
          'grid size-4.5 cursor-pointer place-items-center rounded-xs border-0 bg-transparent p-0 text-acc opacity-70 hover:bg-acc-100 hover:opacity-100',
          focusRing,
        )}
      >
        <Icon name="close" size={12} />
      </button>
    </span>
  );
}

export interface GroupOption<V extends string> {
  value: V;
  label: string;
}

export interface GroupSwitchProps<V extends string> {
  options: readonly GroupOption<V>[];
  value: V;
  onChange: (value: V) => void;
}

/** "Group" and its segments (kit.css `.seg`): a radio group the arrow keys move through. */
export function GroupSwitch<V extends string>({ options, value, onChange }: GroupSwitchProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  };
  return (
    <span className="flex items-center gap-2">
      <span className="text-tx-3" aria-hidden>
        Group
      </span>
      <span
        role="radiogroup"
        aria-label="Group by"
        className="inline-flex rounded-card bg-sunken p-0.5 ring-1 ring-line ring-inset"
      >
        {options.map((option, index) => {
          const on = option.value === value;
          return (
            <button
              key={option.value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cx(
                'inline-flex h-6 cursor-pointer items-center rounded-panel border-0 px-2.5 font-sans text-13',
                on
                  ? 'bg-card font-[550] text-tx shadow-e1'
                  : 'bg-transparent text-tx-2 hover:text-tx',
                focusRing,
              )}
            >
              {option.label}
            </button>
          );
        })}
      </span>
    </span>
  );
}

export interface FilterBarProps {
  search: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /** Names the field: "Filter this board". */
    label: string;
  };
  /** The search field, so the screen can focus it on "/". */
  searchRef?: Ref<HTMLInputElement>;
  /** The filters that are set, each removable. */
  applied: readonly AppliedFilter[];
  /** Clears every filter; shown once two or more are set. */
  onClearAll?: () => void;
  /** The Filter menu, already wired to a FilterChipButton trigger. */
  filterMenu?: ReactNode;
  /** The Saved views menu, already wired to its trigger. */
  savedViews?: ReactNode;
  /** Drawn before Group on the right, e.g. the epics rail switch. */
  extra?: ReactNode;
  group?: ReactNode;
  /** The Display menu, already wired to its trigger. */
  display?: ReactNode;
  /** Replaces the search box, e.g. with the query bar while it is open. */
  searchSlot?: ReactNode;
  className?: string;
}

/** The filter row: 46px, 24px gutters, a hairline under it. On phones it scrolls sideways. */
export function FilterBar({
  search,
  searchRef,
  applied,
  onClearAll,
  filterMenu,
  savedViews,
  extra,
  group,
  display,
  searchSlot,
  className,
}: FilterBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Filters"
      className={cx(
        'flex h-11.5 shrink-0 items-center gap-2 overflow-x-auto border-b border-line px-6 text-13 [scrollbar-width:none] max-md:px-4',
        className,
      )}
    >
      {searchSlot ?? (
        <label className="flex h-6.5 w-50 shrink-0 items-center gap-1.5 rounded-panel px-2 text-tx-3 focus-within:bg-hover max-md:w-36">
          <Icon name="search" size={14} />
          <input
            ref={searchRef}
            type="search"
            aria-label={search.label}
            placeholder={search.placeholder ?? 'Filter issues…'}
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && search.value) {
                event.stopPropagation();
                search.onChange('');
              }
            }}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-13 text-tx outline-none placeholder:text-tx-3 [&::-webkit-search-cancel-button]:hidden"
          />
          {!search.value && <Kbd keys="/" variant="plain" />}
        </label>
      )}
      <span aria-hidden className="h-4 w-px shrink-0 bg-line" />
      {applied.map((filter) => (
        <AppliedFilterChip key={filter.id} filter={filter} />
      ))}
      {filterMenu}
      {savedViews}
      {onClearAll && applied.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className={cx(
            'h-6.5 shrink-0 cursor-pointer rounded-panel border-0 bg-transparent px-1.5 font-sans text-13 text-tx-3 hover:text-tx',
            focusRing,
          )}
        >
          Clear
        </button>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-2 pl-2">
        {extra}
        {group}
        {display}
      </span>
    </div>
  );
}
