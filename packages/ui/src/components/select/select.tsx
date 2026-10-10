import { useId, useImperativeHandle } from 'react';
import { Icon, ICON_SIZE } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { caretTone } from '../../lib/focus.ts';
import { SelectList } from './select-list.tsx';
import type { SelectProps, SelectSize } from './types.ts';
import { useSelect } from './use-select.ts';

/**
 * md: the Board Settings "Starts on" select and the People filters (32px, 10px padding, 6px
 * between label and caret). sm: the People role select (26px, 9px padding, 5px radius, 12.5px
 * medium). lg: the Setup form's 36px field, beside Input lg.
 */
const SIZES: Record<SelectSize, string> = {
  sm: 'h-6.5 gap-1.5 rounded-chip px-2.25 text-13 font-medium',
  md: 'h-control gap-1.5 rounded-control px-2.5 text-13',
  lg: 'h-9 gap-2 rounded-control px-3 text-13',
};

/** The ghost variant keeps the value's own weight and only shows its border when touched. */
const GHOST = 'h-6.5 gap-1.5 rounded-chip px-2 border-transparent bg-transparent hover:border-line';
const GHOST_CARET =
  'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-aria-expanded:opacity-100';

/** The props the list consumes; everything else goes on the trigger button. */
const LIST_PROPS = [
  'options',
  'groups',
  'value',
  'defaultValue',
  'onChange',
  'searchable',
  'loadOptions',
  'maxVisible',
] as const;

function buttonAttributes<T extends object>(props: T): Omit<T, (typeof LIST_PROPS)[number]> {
  const out = { ...props } as Record<string, unknown>;
  for (const key of LIST_PROPS) delete out[key];
  return out as Omit<T, (typeof LIST_PROPS)[number]>;
}

/**
 * The one dropdown of the product: a button showing the value with the caret, opening a
 * listbox in a portalled popover. Three options or three hundred behave the same way: at most
 * `maxVisible` are drawn, `searchable` adds a search box, and `loadOptions` asks the server.
 * Keyboard: arrows, Home and End move, letters jump (or type into the search), Enter and Space
 * choose, Escape closes and Tab moves on.
 */
export function Select({ ref, ...props }: SelectProps) {
  const {
    placeholder,
    size = 'md',
    variant = 'outline',
    error,
    searchPlaceholder = 'Search',
    name,
    className,
    wrapperClassName,
    disabled,
    id,
    'aria-label': ariaLabel,
    'aria-invalid': ariaInvalid,
    ...other
  } = props;
  const rest = buttonAttributes(other);
  const state = useSelect(props);
  const { setTrigger } = state;
  const ownId = useId();
  const triggerId = id ?? ownId;
  useImperativeHandle(ref, () => state.anchor as HTMLButtonElement, [state.anchor]);
  const invalid = Boolean(error) || ariaInvalid === true || ariaInvalid === 'true';
  const activeId =
    state.open && !state.searchOn && state.active >= 0 ? state.optionId(state.active) : undefined;

  return (
    <>
      <button
        {...rest}
        ref={setTrigger}
        id={triggerId}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={state.open}
        aria-controls={state.open ? state.listId : undefined}
        aria-activedescendant={activeId}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={state.toggle}
        onKeyDown={state.onKeyDown}
        className={cx(
          'group inline-flex max-w-full min-w-0 shrink-0 cursor-pointer items-center border text-left font-sans text-tx outline-0',
          'focus-ring focus-visible:border-acc aria-expanded:border-acc aria-expanded:shadow-ring',
          'aria-invalid:border-red disabled:cursor-not-allowed disabled:opacity-50',
          variant === 'ghost' ? GHOST : cx('border-line bg-card', SIZES[size]),
          wrapperClassName,
          className,
        )}
      >
        {state.selected?.icon && (
          <span aria-hidden className="inline-flex shrink-0">
            {state.selected.icon}
          </span>
        )}
        <span className={cx('min-w-0 flex-1 truncate', !state.selected && 'text-tx-3')}>
          {state.selected?.label ?? placeholder ?? ''}
        </span>
        <Icon
          name="caret"
          size={size === 'sm' || variant === 'ghost' ? ICON_SIZE.small : ICON_SIZE.inline}
          className={cx(caretTone, variant === 'ghost' && GHOST_CARET)}
        />
      </button>
      {name !== undefined && <input type="hidden" name={name} value={state.value} />}
      {state.open && (
        <SelectList
          state={state}
          label={ariaLabel}
          labelledBy={triggerId}
          searchPlaceholder={searchPlaceholder}
        />
      )}
    </>
  );
}
