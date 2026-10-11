import type { TemplateField } from '@bemmoly/module-docs/shared';
import { Button, IconButton, Input, Select } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';

/** What a field asks for, in words; the stored kinds are the page form's. */
export const FIELD_KINDS: Record<TemplateField['kind'], string> = {
  text: 'Text',
  user: 'Person',
  users: 'People',
  date: 'Date',
  select: 'Choice',
};

const KIND_OPTIONS = Object.entries(FIELD_KINDS).map(([value, label]) => ({ value, label }));

export const MOST_FIELDS = 20;

/** "Due date" becomes due_date; a clash or a label with no letters gets a numbered key. */
export function fieldKey(label: string, taken: readonly string[]): string {
  const base =
    label
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^[^a-z]+|_+$/g, '')
      .slice(0, 36) || 'field';
  let key = base;
  for (let n = 2; taken.includes(key); n += 1) key = `${base}_${n}`;
  return key;
}

/** A field's choices as typed: "Draft, Review, Final". */
const optionsText = (field: TemplateField) => (field.options ?? []).join(', ');
const parseOptions = (text: string) =>
  text
    .split(',')
    .map((option) => option.trim())
    .filter(Boolean)
    .slice(0, 20);

/** The read view's line for one field: "Status · Choice: Draft, Review, Final". */
export function fieldSummary(field: TemplateField): string {
  const options = field.kind === 'select' && field.options?.length ? `: ${optionsText(field)}` : '';
  return `${FIELD_KINDS[field.kind]}${options}`;
}

/** The choices as typed, so a trailing comma survives the keystroke that adds it. */
function ChoicesInput({
  field,
  onChange,
}: {
  field: TemplateField;
  onChange: (options: string[]) => void;
}) {
  const [text, setText] = useState(() => optionsText(field));
  return (
    <Input
      aria-label={`Choices for ${field.label || 'this field'}`}
      placeholder="Choices, separated by commas"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        onChange(parseOptions(event.target.value));
      }}
    />
  );
}

/**
 * The fields a page made from the template asks for as it is created: a label, what it holds,
 * and for a choice its options. Keys follow the labels, so nobody types one.
 */
export function FieldsEditor({
  fields,
  onChange,
}: {
  fields: readonly TemplateField[];
  onChange: (fields: TemplateField[]) => void;
}) {
  const set = (index: number, patch: Partial<TemplateField>) =>
    onChange(
      fields.map((field, at) => {
        if (at !== index) return field;
        const next = { ...field, ...patch };
        if (patch.label !== undefined) {
          const others = fields.filter((_, other) => other !== index).map((item) => item.key);
          next.key = fieldKey(patch.label, others);
        }
        if (next.kind !== 'select') delete next.options;
        return next;
      }),
    );
  const add = () =>
    onChange([
      ...fields,
      {
        key: fieldKey(
          'Field',
          fields.map((field) => field.key),
        ),
        label: '',
        kind: 'text',
      },
    ]);
  return (
    <div className="flex flex-col gap-2">
      {fields.length === 0 && (
        <p className="m-0 text-13 text-tx-3">
          No fields. A page made from this template starts with its body only.
        </p>
      )}
      {fields.map((field, index) => (
        <div
          key={index}
          role="group"
          aria-label={`Field ${index + 1}`}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_auto]"
        >
          <span className="order-1 min-w-0">
            <Input
              aria-label="Field label"
              placeholder="Label, such as Status"
              value={field.label}
              maxLength={60}
              onChange={(event) => set(index, { label: event.target.value })}
            />
          </span>
          <span className="order-3 col-span-2 sm:order-2 sm:col-span-1">
            <Select
              aria-label="Field kind"
              value={field.kind}
              options={KIND_OPTIONS}
              onChange={(event) => set(index, { kind: event.value as TemplateField['kind'] })}
            />
          </span>
          <span
            className={`order-4 col-span-2 min-w-0 sm:order-3 sm:col-span-1 ${field.kind === 'select' ? '' : 'hidden sm:block'}`}
          >
            {field.kind === 'select' && (
              <ChoicesInput
                key={`${index}:${field.key}`}
                field={field}
                onChange={(options) => set(index, { options })}
              />
            )}
          </span>
          <span className="order-2 sm:order-4">
            <IconButton
              label={`Remove ${field.label || 'this field'}`}
              icon={<Icon name="close" />}
              onClick={() => onChange(fields.filter((_, at) => at !== index))}
            />
          </span>
        </div>
      ))}
      {fields.length < MOST_FIELDS && (
        <span>
          <Button size="sm" variant="ghost" icon={<Icon name="plus" />} onClick={add}>
            Add field
          </Button>
        </span>
      )}
    </div>
  );
}
