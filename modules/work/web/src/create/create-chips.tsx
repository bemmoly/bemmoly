import { Icon } from '@bemmoly/ui/icons';
import { Menu, MenuItem, Select, type LoadOptions, type SelectOption } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { cx } from '../issue/cx.ts';

/** The review's `.btn.sm`: 26px, 6px radius, a hairline, medium 12px. */
export const CHIP =
  'h-6.5 max-w-60 gap-1.5 rounded-control border-line bg-card px-2 text-12 font-medium shadow-none';

const NONE = '__none';

export interface ChipSelectProps {
  /** The property's name: the chip's accessible name and its text while empty. */
  name: string;
  value: string | null;
  options: readonly SelectOption[];
  onChange: (value: string | null) => void;
  /** The choice that clears the property ("Unassigned", "Backlog"); omit when it cannot be empty. */
  noneLabel?: string;
  /** Shown before the name while empty. */
  emptyIcon?: ReactNode;
  loadOptions?: LoadOptions;
  invalid?: boolean;
  disabled?: boolean;
}

/**
 * One property as a chip: the chosen value with its glyph, or the property's name in the
 * quiet grey while it is empty. It opens the product's one dropdown.
 */
export function ChipSelect({
  name,
  value,
  options,
  onChange,
  noneLabel,
  emptyIcon,
  loadOptions,
  invalid,
  disabled,
}: ChipSelectProps) {
  const all = noneLabel ? [{ value: NONE, label: noneLabel }, ...options] : options;
  const empty = !value;
  return (
    <span className="relative inline-flex">
      {empty && emptyIcon && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2 z-1 inline-flex -translate-y-1/2 text-tx-3"
        >
          {emptyIcon}
        </span>
      )}
      <Select
        aria-label={name}
        size="sm"
        value={value ?? ''}
        placeholder={name}
        options={all}
        {...(loadOptions ? { loadOptions } : {})}
        error={invalid}
        disabled={disabled}
        onChange={(event) => onChange(event.value === NONE ? null : event.value)}
        className={cx(CHIP, empty && emptyIcon ? 'pl-7' : undefined, empty && '[&>span]:text-tx-3')}
      />
    </span>
  );
}

export interface ChipMultiProps {
  name: string;
  values: readonly string[];
  options: readonly SelectOption[];
  onChange: (values: string[]) => void;
  icon: ReactNode;
  invalid?: boolean;
}

/** Labels: several at once, from a menu that stays open while you tick. */
export function ChipMulti({ name, values, options, onChange, icon, invalid }: ChipMultiProps) {
  const chosen = options.filter((option) => values.includes(option.value));
  const text =
    chosen.length === 0
      ? name
      : chosen.length <= 2
        ? chosen.map((option) => option.label).join(', ')
        : `${chosen[0]?.label ?? ''} +${chosen.length - 1}`;
  const toggle = (value: string) =>
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  return (
    <Menu
      widthClassName="min-w-50 max-w-72"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          aria-label={chosen.length ? `${name}: ${text}` : name}
          aria-invalid={invalid || undefined}
          className={cx(
            'inline-flex cursor-pointer items-center border font-sans focus-ring',
            'aria-invalid:border-red hover:bg-hover aria-expanded:border-acc',
            CHIP,
            chosen.length ? 'text-tx' : 'text-tx-3',
          )}
        >
          <span aria-hidden className="inline-flex text-tx-3">
            {icon}
          </span>
          <span className="min-w-0 truncate">{text}</span>
        </button>
      )}
    >
      {options.length === 0 ? (
        <p className="m-0 px-2.5 py-2 text-12 text-tx-3">This project has no labels yet.</p>
      ) : (
        options.map((option) => (
          <MenuItem
            key={option.value}
            keepOpen
            checked={values.includes(option.value)}
            icon={option.icon}
            onSelect={() => toggle(option.value)}
          >
            {option.label}
          </MenuItem>
        ))
      )}
    </Menu>
  );
}

export interface ChipNumberProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}

/** Story points: a chip with a small number field in it. */
export function ChipNumber({ name, value, onChange, invalid }: ChipNumberProps) {
  return (
    <label
      className={cx(
        'inline-flex cursor-text items-center border focus-within:border-acc',
        CHIP,
        invalid && 'border-red',
        value ? 'text-tx' : 'text-tx-3',
      )}
    >
      <span className="sr-only">{name}</span>
      <input
        type="number"
        min={0}
        inputMode="decimal"
        value={value}
        placeholder="–"
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
        className="w-7 [appearance:textfield] border-0 bg-transparent p-0 text-center font-mono text-12 text-tx tabular-nums outline-0 placeholder:text-tx-3 [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span aria-hidden>{value === '1' ? 'Point' : 'Points'}</span>
    </label>
  );
}

/** The ··· chip: shows the fields the type has beyond the common ones. */
export function ChipMore({
  open,
  onToggle,
  count,
}: {
  open: boolean;
  onToggle: () => void;
  count: number;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={open ? 'Fewer fields' : `More fields (${count})`}
      title={open ? 'Fewer fields' : 'More fields'}
      onClick={onToggle}
      className={cx(
        'inline-flex cursor-pointer items-center border font-sans text-tx-3 focus-ring hover:bg-hover',
        CHIP,
      )}
    >
      <Icon name="more" size={14} />
    </button>
  );
}
