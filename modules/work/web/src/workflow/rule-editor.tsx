import { Field, IconButton, Input, RuleChip, Switch } from '@bemmoly/ui';
import { useId, useState } from 'react';
import type { WorkflowRule, WorkflowRuleDefinition } from '../../../shared/index.ts';
import {
  chipKind,
  missingArgs,
  paramFields,
  ruleSentence,
  type ParamField,
} from './rule-params.ts';

type Args = Record<string, unknown>;

/** A comma-separated list ("reviewer, fixVersion") kept as typed until it parses. */
function ListInput({
  field,
  value,
  onChange,
}: {
  field: ParamField;
  value: unknown;
  onChange: (next: string[]) => void;
}) {
  const [text, setText] = useState(Array.isArray(value) ? value.join(', ') : '');
  return (
    <Input
      mono={field.mono}
      value={text}
      placeholder="reviewer, fixVersion"
      onChange={(event) => {
        setText(event.target.value);
        onChange(
          event.target.value
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean),
        );
      }}
    />
  );
}

function ParamInput({
  field,
  value,
  onChange,
}: {
  field: ParamField;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const id = useId();
  if (field.control === 'boolean') {
    const checked = Boolean(value ?? field.fallback);
    return (
      <span className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="font-medium text-tx">
          {field.label}
        </label>
        <Switch id={id} size="sm" checked={checked} onCheckedChange={onChange} />
      </span>
    );
  }
  const label = `${field.label}${field.required ? ' *' : ''}`;
  if (field.control === 'list')
    return (
      <Field label={label} hint="Separate field keys with commas">
        <ListInput field={field} value={value} onChange={onChange} />
      </Field>
    );
  if (field.control === 'number')
    return (
      <Field label={label}>
        <Input
          type="number"
          inputMode="numeric"
          {...(field.min === undefined ? {} : { min: field.min })}
          {...(field.max === undefined ? {} : { max: field.max })}
          value={typeof value === 'number' ? String(value) : ''}
          placeholder={field.fallback === undefined ? '' : String(field.fallback)}
          onChange={(event) =>
            onChange(event.target.value === '' ? undefined : Number(event.target.value))
          }
        />
      </Field>
    );
  return (
    <Field label={label}>
      <Input
        mono={field.mono}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export interface RuleEditorProps {
  rule: WorkflowRule;
  definition: WorkflowRuleDefinition | undefined;
  /** The kind of the slot the rule sits in, for the chip when the registry does not know it. */
  kind: WorkflowRuleDefinition['kind'];
  onChange: (args: Args) => void;
  onRemove: () => void;
}

/**
 * One condition, validator or post-action: the mock's rule row (chip and
 * sentence in a br frame), with its arguments as a small form under it.
 */
export function RuleEditor({ rule, definition, kind, onChange, onRemove }: RuleEditorProps) {
  const fields = definition ? paramFields(definition) : [];
  const missing = definition ? missingArgs(definition, rule.args) : [];
  const sentence = ruleSentence(definition, rule.name, rule.args);
  const set = (key: string, value: unknown) => {
    const next = { ...rule.args };
    if (value === undefined) delete next[key];
    else next[key] = value;
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2.5 rounded-control border border-line px-2.5 py-2 text-13 text-tx">
      <div className="flex items-start gap-2">
        <RuleChip kind={chipKind(definition?.kind ?? kind)} className="mt-px" />
        <span className="flex-1 leading-note">{sentence}</span>
        <IconButton
          label={`Remove ${definition?.label ?? rule.name}`}
          icon="close"
          size="xs"
          onClick={onRemove}
        />
      </div>
      {fields.length > 0 && (
        <div className="flex flex-col gap-2.5 border-t border-line-2 pt-2.5">
          {fields.map((field) => (
            <ParamInput
              key={field.key}
              field={field}
              value={rule.args[field.key]}
              onChange={(value) => set(field.key, value)}
            />
          ))}
        </div>
      )}
      {missing.length > 0 && (
        <span className="text-12 text-red">Fill in {missing.join(', ')}.</span>
      )}
      {definition && !definition.available && (
        <span className="text-12 text-tx-3">
          This install cannot run this rule yet; moves it guards are refused.
        </span>
      )}
    </div>
  );
}
