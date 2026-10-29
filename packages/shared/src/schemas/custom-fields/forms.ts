import { z } from 'zod';
import { moduleIdSchema } from '../../modules/index.ts';
import { customFieldKeySchema, entityTypeSchema } from './definitions.ts';
import { isEmptyValue, type FieldValues } from './values.ts';

/*
 * A form is fields plus layout: sections that list field keys, each section or item shown
 * only while its condition holds (ADR 0052). Hidden fields are neither required nor stored.
 */

export const FORM_CONDITION_OPERATORS = [
  'equals',
  'not_equals',
  'in',
  'is_set',
  'is_empty',
] as const;

export const formConditionSchema = z.object({
  field: customFieldKeySchema,
  operator: z.enum(FORM_CONDITION_OPERATORS),
  /** A scalar for equals; a list for in; nothing for is_set and is_empty. */
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
});
export type FormCondition = z.infer<typeof formConditionSchema>;

/** Every condition must hold; an empty list always does. */
const conditionsSchema = z.array(formConditionSchema).max(10).default([]);

export const formItemSchema = z.object({
  field: customFieldKeySchema,
  /** Full width in a two-column section (long text, a multi-select). */
  full: z.boolean().default(false),
  when: conditionsSchema,
});
export type FormItem = z.infer<typeof formItemSchema>;

export const formSectionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
  title: z.string().trim().max(80).default(''),
  description: z.string().max(500).default(''),
  columns: z.union([z.literal(1), z.literal(2)]).default(1),
  items: z.array(formItemSchema).min(1).max(100),
  when: conditionsSchema,
});
export type FormSection = z.infer<typeof formSectionSchema>;

export const formLayoutSchema = z
  .array(formSectionSchema)
  .min(1)
  .max(20)
  .superRefine((sections, ctx) => {
    const keys = sections.flatMap((section) => section.items.map((item) => item.field));
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({ code: 'custom', message: 'A field appears in a form once' });
  });
export type FormLayout = z.infer<typeof formLayoutSchema>;

export const customFormSchema = z.object({
  id: z.uuid(),
  moduleId: moduleIdSchema,
  entityType: entityTypeSchema,
  key: customFieldKeySchema,
  title: z.string().trim().min(1).max(80),
  description: z.string().max(1000),
  sections: formLayoutSchema,
  archived: z.boolean(),
});
export type CustomForm = z.infer<typeof customFormSchema>;

export const createCustomFormBodySchema = z.object({
  moduleId: moduleIdSchema,
  entityType: entityTypeSchema,
  key: customFieldKeySchema,
  title: z.string().trim().min(1).max(80),
  description: z.string().max(1000).default(''),
  sections: formLayoutSchema,
});
export type CreateCustomFormBody = z.input<typeof createCustomFormBodySchema>;
export type CreateCustomForm = z.output<typeof createCustomFormBodySchema>;

export const submitCustomFormBodySchema = z.object({
  values: z.record(z.string(), z.unknown()),
  /** The entity the values are written onto; absent for a request that creates nothing yet. */
  entityId: z.uuid().optional(),
});
export type SubmitCustomFormBody = z.infer<typeof submitCustomFormBodySchema>;

export interface CustomFormSubmission {
  id: string;
  formId: string;
  entityId: string | null;
  submittedBy: string | null;
  values: FieldValues;
  createdAt: string;
}

/** The event approvals and other subscribers listen for; published in the submit transaction. */
export const CUSTOM_FORM_SUBMITTED_EVENT = 'custom_form.submitted';
export interface CustomFormSubmittedPayload {
  submissionId: string;
  formId: string;
  formKey: string;
  moduleId: string;
  entityType: string;
  entityId: string | null;
  values: FieldValues;
}

const same = (a: unknown, b: unknown) => (Array.isArray(a) ? a.includes(b as string) : a === b);

export function conditionHolds(condition: FormCondition, values: FieldValues): boolean {
  const current = values[condition.field];
  switch (condition.operator) {
    case 'is_set':
      return !isEmptyValue(current);
    case 'is_empty':
      return isEmptyValue(current);
    case 'equals':
      return same(current, condition.value);
    case 'not_equals':
      return !same(current, condition.value);
    case 'in': {
      const list = Array.isArray(condition.value) ? condition.value : [];
      return Array.isArray(current)
        ? current.some((v) => list.includes(v as string))
        : list.includes(current as string);
    }
  }
}

const allHold = (when: readonly FormCondition[], values: FieldValues) =>
  when.every((condition) => conditionHolds(condition, values));

/** The sections shown for `values`, each with only its shown items, in layout order. */
export function visibleSections(sections: FormLayout, values: FieldValues): FormLayout {
  return sections
    .filter((section) => allHold(section.when, values))
    .map((section) => ({ ...section, items: section.items.filter((i) => allHold(i.when, values)) }))
    .filter((section) => section.items.length > 0);
}

const keysOf = (sections: FormLayout) =>
  new Set(sections.flatMap((section) => section.items.map((item) => item.field)));

/**
 * The keys a submission of `values` validates and stores. A hidden field counts as empty for
 * the conditions that read it, so hiding one can hide what depended on it; that settles
 * within one pass per field.
 */
export function visibleFieldKeys(sections: FormLayout, values: FieldValues): Set<string> {
  let keys = keysOf(visibleSections(sections, values));
  for (let pass = 0; pass < 100; pass += 1) {
    const shown = Object.fromEntries(Object.entries(values).filter(([key]) => keys.has(key)));
    const next = keysOf(visibleSections(sections, shown));
    if (next.size === keys.size && [...next].every((key) => keys.has(key))) return next;
    keys = next;
  }
  return keys;
}
