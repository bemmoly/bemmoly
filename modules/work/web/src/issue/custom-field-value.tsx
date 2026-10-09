import type { Field } from '@bemmoly/module-work/shared';
import { Tag } from '@bemmoly/ui';
import { ChoiceField, InlineValue, PersonField } from './field-editors.tsx';
import { formatDay } from './vocabulary.ts';

export interface CustomFieldValueProps {
  field: Field;
  value: unknown;
  onSave: (value: unknown) => void;
}

const asText = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

/** One custom field's value in Details, edited the way its kind is. */
export function CustomFieldValue({ field, value, onSave }: CustomFieldValueProps) {
  const text = asText(value);
  switch (field.kind) {
    case 'select':
      return (
        <ChoiceField
          label={field.name}
          value={text || null}
          options={field.options.map((option) => ({ value: option.value, label: option.label }))}
          onSave={onSave}
        />
      );
    case 'multiselect': {
      const chosen = Array.isArray(value) ? value.map(String) : [];
      const label = (key: string) => field.options.find((o) => o.value === key)?.label ?? key;
      return (
        <>
          {chosen.map((key) => (
            <Tag key={key} onRemove={() => onSave(chosen.filter((item) => item !== key))}>
              {label(key)}
            </Tag>
          ))}
          <ChoiceField
            label={`Add ${field.name.toLowerCase()}`}
            value={null}
            noneLabel={chosen.length ? 'Add…' : 'None'}
            options={field.options
              .filter((option) => !chosen.includes(option.value))
              .map((option) => ({ value: option.value, label: option.label }))}
            onSave={(next) => next && onSave([...chosen, next])}
          />
        </>
      );
    }
    case 'user':
      return (
        <PersonField label={field.name} value={text || null} noneLabel="Nobody" onSave={onSave} />
      );
    case 'number':
      return (
        <InlineValue
          label={field.name}
          type="number"
          mono
          value={text}
          validate={(next) => (next && !Number.isFinite(Number(next)) ? 'Use a number.' : null)}
          onSave={(next) => onSave(next === '' ? null : Number(next))}
        />
      );
    case 'date':
      return (
        <InlineValue
          label={field.name}
          type="date"
          value={text.slice(0, 10)}
          display={formatDay(text || null) || null}
          onSave={(next) => onSave(next || null)}
        />
      );
    case 'url':
      return (
        <InlineValue
          label={field.name}
          type="url"
          value={text}
          display={text ? <span className="truncate text-ac">{text}</span> : null}
          validate={(next) => (next && !/^https?:\/\//.test(next) ? 'Start with https://' : null)}
          onSave={(next) => onSave(next || null)}
        />
      );
    default:
      return (
        <InlineValue
          label={field.name}
          type={field.kind === 'datetime' ? 'datetime-local' : 'text'}
          value={text}
          onSave={(next) => onSave(next || null)}
        />
      );
  }
}
