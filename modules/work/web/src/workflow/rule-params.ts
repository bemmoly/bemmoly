import type { WorkflowRuleDefinition, WorkflowRuleKind } from '../../../shared/index.ts';

/*
 * The rules registry sends each rule's arguments as the JSON Schema the
 * server derives from its zod schema. The editor draws one small control per
 * property; these are the shapes the registry uses today, and anything else
 * falls back to a text box the server validates on save.
 */

export type ParamControl = 'text' | 'number' | 'boolean' | 'list';

export interface ParamField {
  key: string;
  label: string;
  control: ParamControl;
  required: boolean;
  /** The schema's default, shown until the person sets a value. */
  fallback: unknown;
  min?: number;
  max?: number;
  mono: boolean;
}

interface PropertySchema {
  type?: string;
  format?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  items?: PropertySchema;
}

/** "minLength" → "Min length", "ruleId" → "Rule id". */
export function humanize(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

function controlOf(schema: PropertySchema): ParamControl {
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'integer' || schema.type === 'number') return 'number';
  if (schema.type === 'array') return 'list';
  return 'text';
}

export function paramFields(rule: Pick<WorkflowRuleDefinition, 'params'>): ParamField[] {
  const properties = (rule.params['properties'] ?? {}) as Record<string, PropertySchema>;
  const required = new Set((rule.params['required'] as string[] | undefined) ?? []);
  return Object.entries(properties).map(([key, schema]) => ({
    key,
    label: humanize(key),
    control: controlOf(schema),
    required: required.has(key),
    fallback: schema.default,
    ...(schema.minimum === undefined ? {} : { min: schema.minimum }),
    ...(schema.maximum === undefined ? {} : { max: schema.maximum }),
    mono: schema.format === 'uuid' || key === 'query' || key === 'field' || key === 'fields',
  }));
}

/** Arguments a new rule starts with: each property's default, nothing for the rest. */
export function defaultArgs(rule: Pick<WorkflowRuleDefinition, 'params'>): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const field of paramFields(rule))
    if (field.fallback !== undefined) args[field.key] = field.fallback;
  return args;
}

/** Required arguments still empty, which Validate would report. */
export function missingArgs(
  rule: Pick<WorkflowRuleDefinition, 'params'>,
  args: Record<string, unknown>,
): string[] {
  return paramFields(rule)
    .filter((field) => field.required)
    .filter((field) => {
      const value = args[field.key];
      return value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
    })
    .map((field) => field.label);
}

function show(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
}

/** The sentence beside a rule's chip: its label, then the arguments that are set. */
export function ruleSentence(
  rule: Pick<WorkflowRuleDefinition, 'label' | 'params'> | undefined,
  name: string,
  args: Record<string, unknown>,
): string {
  if (!rule) return `Unknown rule "${name}"`;
  const fields = paramFields(rule);
  const set = fields
    .map((field) => [field, args[field.key] ?? field.fallback] as const)
    .filter(([, value]) => value !== undefined && value !== '');
  if (set.length === 0) return rule.label;
  /** One argument reads as "Required fields: reviewer"; several name each one. */
  const parts =
    fields.length === 1
      ? set.map(([, value]) => show(value))
      : set.map(([field, value]) => `${field.label.toLowerCase()} ${show(value)}`);
  return `${rule.label}: ${parts.join(', ')}`;
}

/** The design system names the post-action kind "post", as the mock's chip does. */
export const chipKind = (kind: WorkflowRuleKind) => (kind === 'post_action' ? 'post' : kind);
