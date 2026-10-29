import { z } from 'zod';
import { moneyValueSchema, type CustomFieldDefinition } from './definitions.ts';

/*
 * One validator for the server and the browser (ADR 0052): a form never accepts what the
 * service would refuse, and the message under a field is the one the API would send.
 */

/** Values by field key. `null` clears a field. */
export type FieldValues = Record<string, unknown>;

export interface FieldIssue {
  key: string;
  message: string;
}

/** The parts of a definition validation reads, so a form can validate without ids. */
export type FieldRules = Pick<
  CustomFieldDefinition,
  'key' | 'label' | 'kind' | 'required' | 'options' | 'validation'
>;

const TEXT_MAX = 500;
const LONG_TEXT_MAX = 10_000;

function textSchema(field: FieldRules, ceiling: number): z.ZodType {
  const { minLength, maxLength, pattern } = field.validation;
  let schema = z
    .string()
    .trim()
    .max(Math.min(maxLength ?? ceiling, ceiling), {
      error: `Keep it under ${Math.min(maxLength ?? ceiling, ceiling)} characters`,
    });
  if (minLength) schema = schema.min(minLength, { error: `Use at least ${minLength} characters` });
  if (pattern) schema = schema.regex(new RegExp(`^(?:${pattern})$`), 'Use the expected format');
  return schema;
}

function numberSchema(field: FieldRules): z.ZodType {
  const { min, max, decimals } = field.validation;
  let schema = z.number({ error: 'Enter a number' }).finite();
  if (min !== undefined) schema = schema.min(min, { error: `Use ${min} or more` });
  if (max !== undefined) schema = schema.max(max, { error: `Use ${max} or less` });
  if (decimals === undefined) return schema;
  const scale = 10 ** decimals;
  return schema.refine((n) => Math.abs(Math.round(n * scale) - n * scale) < 1e-6, {
    error: decimals === 0 ? 'Use a whole number' : `Use at most ${decimals} decimals`,
  });
}

function moneySchema(field: FieldRules): z.ZodType {
  const { currency, min, max } = field.validation;
  return moneyValueSchema
    .refine((m) => !currency || m.currency === currency, { error: `Use ${currency}` })
    .refine((m) => min === undefined || m.amountMinor >= min, {
      error: 'The amount is below the minimum',
    })
    .refine((m) => max === undefined || m.amountMinor <= max, {
      error: 'The amount is above the maximum',
    });
}

function dateSchema(field: FieldRules): z.ZodType {
  const { minDate, maxDate } = field.validation;
  return z.iso
    .date({ error: 'Enter a date' })
    .refine((d) => !minDate || d >= minDate, { error: `Use ${minDate} or later` })
    .refine((d) => !maxDate || d <= maxDate, { error: `Use ${maxDate} or earlier` });
}

/** The zod schema for one non-null value of `field`. */
export function valueSchemaFor(field: FieldRules): z.ZodType {
  const choices = field.options.map((option) => option.value);
  const choice = z
    .string()
    .refine((v) => choices.includes(v), { error: 'Pick one of the options' });
  switch (field.kind) {
    case 'text':
      return textSchema(field, TEXT_MAX);
    case 'long_text':
      return textSchema(field, LONG_TEXT_MAX);
    case 'number':
      return numberSchema(field);
    case 'money':
      return moneySchema(field);
    case 'date':
      return dateSchema(field);
    case 'select':
      return choice;
    case 'multi_select': {
      const most = field.validation.maxItems ?? 100;
      return z
        .array(choice)
        .max(most, { error: `Pick at most ${most}` })
        .transform((values) => [...new Set(values)]);
    }
    case 'person':
    case 'file':
      return z.uuid({ error: field.kind === 'person' ? 'Pick a person' : 'Attach a file' });
    case 'boolean':
      return z.boolean();
  }
}

/** Empty for `required`: nothing, an empty string or an empty list. A false boolean is a value. */
export function isEmptyValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

export interface ValidateOptions {
  /**
   * `create` checks every required field and fills defaults; `update` checks only the keys
   * given, and refuses clearing a required one.
   */
  mode: 'create' | 'update';
  /** Keys a form hid: neither required nor stored. */
  only?: ReadonlySet<string>;
  defaults?: ReadonlyMap<string, unknown>;
}

export type ValidationResult =
  { ok: true; values: FieldValues } | { ok: false; issues: FieldIssue[] };

/** Checks `values` against `fields`; unknown keys are issues, not silently dropped. */
export function validateFieldValues(
  fields: readonly FieldRules[],
  values: FieldValues,
  options: ValidateOptions,
): ValidationResult {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const issues: FieldIssue[] = [];
  const clean: FieldValues = {};
  for (const key of Object.keys(values)) {
    if (!byKey.has(key)) issues.push({ key, message: 'There is no such field' });
  }
  for (const field of fields) {
    if (options.only && !options.only.has(field.key)) continue;
    const given = Object.hasOwn(values, field.key);
    let value = given ? values[field.key] : undefined;
    if (!given && options.mode === 'update') continue;
    if (!given && options.defaults?.has(field.key)) value = options.defaults.get(field.key);
    if (isEmptyValue(value)) {
      if (field.required) issues.push({ key: field.key, message: `${field.label} is required` });
      else if (given) clean[field.key] = null;
      continue;
    }
    const parsed = valueSchemaFor(field).safeParse(value);
    if (parsed.success) clean[field.key] = parsed.data;
    else issues.push({ key: field.key, message: parsed.error.issues[0]?.message ?? 'Not valid' });
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, values: clean };
}
