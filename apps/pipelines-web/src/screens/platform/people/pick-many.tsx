import { Select, Tag, type SelectOption } from '@bemmoly/ui';

/**
 * Several picks from a list: a Select that adds one at a time and the picks as tags that come
 * off again. The design system has no multi-select; this is the Select plus Tags it has.
 */
export function PickMany({
  options,
  value,
  onChange,
  placeholder,
  removeLabel,
  label,
}: {
  options: readonly SelectOption[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  removeLabel: (name: string) => string;
  label: string;
}) {
  const left = options.filter((option) => !value.includes(option.value));
  const named = new Map(options.map((option) => [option.value, option.label]));
  return (
    <div className="flex flex-col gap-2">
      <Select
        aria-label={label}
        value=""
        searchable
        placeholder={placeholder}
        options={left}
        disabled={left.length === 0}
        onChange={(event) => onChange([...value, event.value])}
      />
      {value.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {value.map((id) => (
            <Tag
              key={id}
              onRemove={() => onChange(value.filter((other) => other !== id))}
              removeLabel={removeLabel(named.get(id) ?? '')}
            >
              {named.get(id) ?? id}
            </Tag>
          ))}
        </span>
      )}
    </div>
  );
}
