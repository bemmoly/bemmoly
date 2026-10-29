import { useId, type ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { Checkbox } from '../checkbox/checkbox.tsx';
import { RequiredMark } from '../form-layout/form-layout.tsx';
import { Field } from '../input/field.tsx';
import { Input } from '../input/input.tsx';
import { Select } from '../select/select.tsx';
import type { LoadOptions, SelectOption } from '../select/types.ts';
import { Textarea } from '../textarea/textarea.tsx';
import { MoneyInput, NumberInput, type Money } from './inputs.tsx';

/*
 * One control per custom field kind (ADR 0052), built only from the system's controls. The
 * shape mirrors the kernel's definition structurally, so this package needs no dependency on
 * the contract; core-web binds the two.
 */

export type CustomFieldControlKind =
  | 'text'
  | 'long_text'
  | 'number'
  | 'money'
  | 'date'
  | 'select'
  | 'multi_select'
  | 'person'
  | 'boolean'
  | 'file';

export interface CustomFieldControlSpec {
  key: string;
  label: string;
  kind: CustomFieldControlKind;
  description?: string | null;
  required?: boolean;
  options?: readonly { value: string; label: string }[];
  /** For money: the currency amounts are in. */
  currency?: string;
  /** For number: digits after the point. */
  decimals?: number;
}

export interface CustomFieldControlProps {
  field: CustomFieldControlSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Replaces the description and marks the control invalid. */
  error?: ReactNode;
  disabled?: boolean;
  /** Where person and file pickers find their options; the page decides the source. */
  loadPeople?: LoadOptions;
  loadFiles?: LoadOptions;
  /** Options already known, so a chosen person or file shows its name before any search. */
  knownOptions?: readonly SelectOption[];
}

function ChoiceGroup({ field, value, onChange, error, disabled }: CustomFieldControlProps) {
  const id = useId();
  const chosen = Array.isArray(value) ? (value as string[]) : [];
  const message = error ?? field.description;
  return (
    <fieldset
      className="m-0 flex flex-col gap-1.5 border-0 p-0"
      aria-describedby={message ? `${id}-message` : undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="mb-1.5 p-0 font-medium text-tx">
        {field.label}
        {field.required && <RequiredMark />}
      </legend>
      {(field.options ?? []).map((option) => (
        <Checkbox
          key={option.value}
          label={option.label}
          checked={chosen.includes(option.value)}
          disabled={disabled}
          onChange={(event) =>
            onChange(
              event.target.checked
                ? [...chosen, option.value]
                : chosen.filter((v) => v !== option.value),
            )
          }
        />
      ))}
      {message && (
        <span id={`${id}-message`} className={cx('text-12', error ? 'text-red-tx' : 'text-tx-3')}>
          {message}
        </span>
      )}
    </fieldset>
  );
}

function control(props: CustomFieldControlProps) {
  const { field, value, onChange, disabled } = props;
  const text = typeof value === 'string' ? value : '';
  const empty = (next: string) => onChange(next === '' ? null : next);
  switch (field.kind) {
    case 'text':
      return <Input value={text} disabled={disabled} onChange={(e) => empty(e.target.value)} />;
    case 'long_text':
      return <Textarea value={text} disabled={disabled} onChange={(e) => empty(e.target.value)} />;
    case 'date':
      return (
        <Input
          type="date"
          value={text}
          disabled={disabled}
          onChange={(e) => empty(e.target.value)}
        />
      );
    case 'number':
      return (
        <NumberInput
          value={typeof value === 'number' ? value : null}
          decimals={field.decimals}
          disabled={disabled}
          onChange={onChange}
        />
      );
    case 'money':
      return (
        <MoneyInput
          value={(value as Money | null) ?? null}
          currency={(value as Money | null)?.currency ?? field.currency ?? 'USD'}
          disabled={disabled}
          onChange={onChange}
        />
      );
    case 'select':
    case 'person':
    case 'file': {
      const load = field.kind === 'person' ? props.loadPeople : props.loadFiles;
      const options = field.kind === 'select' ? (field.options ?? []) : (props.knownOptions ?? []);
      return (
        <Select
          options={options}
          value={text}
          disabled={disabled}
          placeholder={field.kind === 'person' ? 'Choose a person' : 'Choose…'}
          {...(field.kind !== 'select' && load ? { loadOptions: load } : {})}
          onChange={(event) => empty(event.value)}
        />
      );
    }
    default:
      return null;
  }
}

/** A labelled control for one custom field, with its description or error under it. */
export function CustomFieldControl(props: CustomFieldControlProps) {
  const { field, value, onChange, error, disabled } = props;
  if (field.kind === 'multi_select') return <ChoiceGroup {...props} />;
  if (field.kind === 'boolean')
    return (
      <div className="flex flex-col gap-1.5">
        <Checkbox
          label={field.label}
          description={error ? undefined : (field.description ?? undefined)}
          checked={value === true}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.checked)}
        />
        {error && <span className="text-12 text-red-tx">{error}</span>}
      </div>
    );
  return (
    <Field
      label={
        <>
          {field.label}
          {field.required && <RequiredMark />}
        </>
      }
      hint={field.description ?? undefined}
      error={error}
    >
      {control(props)!}
    </Field>
  );
}
