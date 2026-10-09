import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

export type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectOption {
  value: string;
  label: string;
  /** A second line under the label, matched by search too (an email under a name). */
  description?: string;
  /** Leading content, such as an avatar or a glyph. */
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SelectGroup {
  label: string;
  options: readonly SelectOption[];
}

/**
 * What onChange receives. It has the shape of a change event's target so callers written for a
 * native select (`event.target.value`) keep working, plus the chosen option.
 */
export interface SelectChangeEvent {
  value: string;
  option: SelectOption;
  target: { value: string; name: string };
  currentTarget: { value: string; name: string };
}

/** Server search: resolve the options matching `query`; abandon the work when `signal` aborts. */
export type LoadOptions = (query: string, signal: AbortSignal) => Promise<readonly SelectOption[]>;

type TriggerAttributes = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'value' | 'defaultValue' | 'onChange' | 'children' | 'type' | 'role'
>;

export interface SelectProps extends TriggerAttributes {
  /** Flat options. Use `groups` instead for labelled sections. */
  options?: readonly SelectOption[];
  groups?: readonly SelectGroup[];
  value?: string;
  defaultValue?: string;
  onChange?: (event: SelectChangeEvent) => void;
  /** Shown in tx5 while no option is chosen. */
  placeholder?: string;
  size?: SelectSize;
  /**
   * outline: the bordered control of forms. ghost: a value in a field list that reads as text
   * until hovered, focused or open, as the Issue sidebar's fields edit in place.
   */
  variant?: 'outline' | 'ghost';
  /** Marks the control invalid; a Field with an error sets aria-invalid, which does the same. */
  error?: boolean;
  /**
   * A search box at the top of the popover, filtering label and description (case and accent
   * insensitive). Turned on by itself when there are more options than `maxVisible`, since the
   * footer then asks people to type.
   */
  searchable?: boolean;
  /** Server search for lists that do not fit in the page. Implies `searchable`. */
  loadOptions?: LoadOptions;
  /** Options drawn at most; a footer says how many more there are. */
  maxVisible?: number;
  /** Shown in the search box. */
  searchPlaceholder?: string;
  /** Submitted with a form under this name, through a hidden input. */
  name?: string;
  ref?: Ref<HTMLButtonElement>;
  /** Kept for callers of the native select: applied to the trigger like className. */
  wrapperClassName?: string;
}
