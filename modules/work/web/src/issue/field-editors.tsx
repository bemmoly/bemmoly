import { Avatar, Input, PRIORITIES, PriorityGlyph, Select, type Priority } from '@bemmoly/ui';
import type { SelectOption } from '@bemmoly/ui';
import { useState, type ReactNode } from 'react';
import { personOption, usePeople } from '../hooks/issue-people.ts';
import { cx } from './cx.ts';

/*
 * The Details values, edited in place. Choices use the ghost Select, which reads as the value
 * until touched; free values swap to an input on click and save on Enter or blur.
 */

/** Pulls a ghost control back so its text lines up with the label column and row height. */
const ALIGN = '-my-1 -ml-2.25';
const NONE = '';

export interface ChoiceFieldProps {
  label: string;
  value: string | null;
  options: readonly SelectOption[];
  onSave: (value: string | null) => void;
  /** Offers "None" to clear the field. */
  clearable?: boolean;
  noneLabel?: string;
  disabled?: boolean;
}

export function ChoiceField({
  label,
  value,
  options,
  onSave,
  clearable = true,
  noneLabel = 'None',
  disabled,
}: ChoiceFieldProps) {
  const all = clearable ? [{ value: NONE, label: noneLabel }, ...options] : options;
  return (
    <Select
      variant="ghost"
      aria-label={label}
      value={value ?? NONE}
      options={all}
      disabled={disabled}
      searchable={all.length > 8}
      className={cx(ALIGN, !value && 'text-tx5')}
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
  noneLabel = 'Unassigned',
  currentName,
}: Omit<ChoiceFieldProps, 'options' | 'clearable'> & {
  /** The chosen person's name, shown before the people list has loaded or pages past them. */
  currentName?: string;
}) {
  const { people, person, loadOptions } = usePeople();
  const listed = people.filter((user) => user.status === 'active').map(personOption);
  const chosen =
    value && !listed.some((option) => option.value === value)
      ? [{ value, label: currentName ?? person(value).name }]
      : [];
  const options = [{ value: NONE, label: noneLabel }, ...chosen, ...listed].map((option) =>
    option.value ? withAvatar(option) : option,
  );
  return (
    <Select
      variant="ghost"
      aria-label={label}
      value={value ?? NONE}
      options={options}
      searchPlaceholder="Search people"
      loadOptions={async (q, signal) => (await loadOptions(q, signal)).map(withAvatar)}
      className={cx(ALIGN, !value && 'text-tx5')}
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
      className={ALIGN}
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
  type?: 'text' | 'number' | 'date' | 'url' | 'datetime-local';
  mono?: boolean;
  /** Returns an error message to keep the input open, or nothing to save. */
  validate?: (value: string) => string | null;
  onSave: (value: string) => void;
}

/** A free value: plain text at rest, an input while editing; Escape puts the old value back. */
export function InlineValue({
  label,
  value,
  display,
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
        aria-label={`${label}: ${value || 'none'}. Edit`}
        onClick={() => setDraft(value)}
        className={cx(
          '-mx-2 -my-0.5 min-w-0 cursor-pointer rounded-sm border-0 bg-transparent px-2 py-0.5 text-left font-sans text-12h text-tx hover:bg-bg2',
          mono && 'font-mono',
          !shown && 'text-tx5',
        )}
      >
        {shown ?? 'None'}
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
    <span className="-my-1.5 flex w-full flex-col gap-1">
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
            setDraft(null);
            setError(null);
          }
        }}
        wrapperClassName="h-7.5 w-full"
      />
      {error && <span className="text-11h text-danger">{error}</span>}
    </span>
  );
}
