import {
  Avatar,
  Input,
  PRIORITIES,
  PriorityGlyph,
  propertyValueClass,
  Select,
  type Priority,
  type SelectOption,
} from '@bemmoly/ui';
import { useState, type ReactNode } from 'react';
import { personOption, usePeople } from '../hooks/issue-people.ts';
import { cx } from './cx.ts';

/*
 * The rail's values, edited in place. Choices use the ghost Select, restyled as a property
 * value: it reads as text with the hover overlay, and an empty one says "Add …". Free values
 * swap to an input on click and save on Enter or blur.
 */

/** The ghost Select as a property value: the overlay, not a border, says it can change. */
const PROPERTY_SELECT =
  '-ml-1.5 h-auto! min-h-7 rounded-control! px-1.5! py-1 text-13 hover:border-transparent! hover:bg-hover aria-expanded:bg-hover';
const NONE = '__none';

export interface ChoiceFieldProps {
  label: string;
  value: string | null;
  options: readonly SelectOption[];
  onSave: (value: string | null) => void;
  /** Shown while empty: "Add version". */
  placeholder?: string;
  /** The option that empties the field: "No sprint". Leave out for a required field. */
  clearLabel?: string;
  disabled?: boolean;
}

export function ChoiceField({
  label,
  value,
  options,
  onSave,
  placeholder = 'Add',
  clearLabel,
  disabled,
}: ChoiceFieldProps) {
  const all = value && clearLabel ? [...options, { value: NONE, label: clearLabel }] : options;
  return (
    <Select
      variant="ghost"
      aria-label={label}
      value={value ?? ''}
      placeholder={placeholder}
      options={all}
      disabled={disabled}
      searchable={all.length > 8}
      className={PROPERTY_SELECT}
      onChange={(event) => onSave(event.value === NONE ? null : event.value)}
    />
  );
}

const withAvatar = (option: SelectOption): SelectOption => ({
  ...option,
  icon: <Avatar name={option.label} size={20} />,
});

/** Assignee, owner and every person field: the workspace's people, searched on the server. */
export function PersonField({
  label,
  value,
  onSave,
  placeholder = 'Add person',
  clearLabel = 'Unassign',
  currentName,
}: Omit<ChoiceFieldProps, 'options'> & {
  /** The chosen person's name, shown before the people list has loaded or pages past them. */
  currentName?: string;
}) {
  const { people, person, loadOptions } = usePeople();
  const listed = people.filter((user) => user.status === 'active').map(personOption);
  const chosen =
    value && !listed.some((option) => option.value === value)
      ? [{ value, label: currentName ?? person(value).name }]
      : [];
  const options = [...chosen, ...listed].map(withAvatar);
  return (
    <Select
      variant="ghost"
      aria-label={label}
      value={value ?? ''}
      placeholder={placeholder}
      options={value ? [...options, { value: NONE, label: clearLabel }] : options}
      searchPlaceholder="Search people"
      loadOptions={async (q, signal) => (await loadOptions(q, signal)).map(withAvatar)}
      className={PROPERTY_SELECT}
      onChange={(event) => onSave(event.value === NONE ? null : event.value)}
    />
  );
}

const PRIORITY_OPTIONS: SelectOption[] = (Object.keys(PRIORITIES) as Priority[]).map((key) => ({
  value: key,
  label: PRIORITIES[key].name,
  icon: <PriorityGlyph priority={key} />,
}));

export function PriorityField({
  value,
  onSave,
}: {
  value: Priority;
  onSave: (value: Priority) => void;
}) {
  return (
    <Select
      variant="ghost"
      aria-label="Priority"
      value={value}
      options={PRIORITY_OPTIONS}
      className={PROPERTY_SELECT}
      onChange={(event) => onSave(event.value as Priority)}
    />
  );
}

export interface InlineValueProps {
  label: string;
  /** The value as an input holds it: "5", "2026-10-07", a URL. */
  value: string;
  /** What the row shows at rest; the raw value when omitted. */
  display?: ReactNode;
  /** Shown while empty: "Add date". */
  placeholder?: string;
  type?: 'text' | 'number' | 'date' | 'url' | 'datetime-local';
  mono?: boolean;
  /** Returns an error message to keep the input open, or nothing to save. */
  validate?: (value: string) => string | null;
  onSave: (value: string) => void;
}

/** A free value: text at rest, an input while editing; Escape puts the old value back. */
export function InlineValue({
  label,
  value,
  display,
  placeholder = 'Add',
  type = 'text',
  mono,
  validate,
  onSave,
}: InlineValueProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (draft === null) {
    const shown = display ?? (value || null);
    return (
      <button
        type="button"
        aria-label={`${label}: ${value || 'empty'}. Change`}
        onClick={() => setDraft(value)}
        className={cx(propertyValueClass, mono && 'font-mono tabular-nums', !shown && 'text-tx-3')}
      >
        <span className="min-w-0 truncate">{shown ?? placeholder}</span>
      </button>
    );
  }

  const commit = () => {
    const next = draft.trim();
    const problem = validate?.(next) ?? null;
    if (problem) {
      setError(problem);
      return;
    }
    setDraft(null);
    setError(null);
    if (next !== value) onSave(next);
  };

  return (
    <span className="-ml-1.5 flex w-full flex-col gap-1">
      <Input
        aria-label={label}
        type={type}
        autoFocus
        mono={mono}
        value={draft}
        aria-invalid={error ? true : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') {
            event.stopPropagation();
            setDraft(null);
            setError(null);
          }
        }}
        wrapperClassName="h-7.5 w-full"
      />
      {error && <span className="text-12 text-red-tx">{error}</span>}
    </span>
  );
}
