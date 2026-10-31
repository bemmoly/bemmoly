import { z } from 'zod';
import { fieldPattern } from './pattern.ts';
import { moduleIdSchema } from '../../modules/index.ts';

/*
 * Company-defined fields any module can attach to its own entities (ADR 0052). A definition
 * is scoped to (module, entity type), so People's `person` and Helpdesk's `ticket` never see
 * each other's fields.
 */

export const CUSTOM_FIELD_KINDS = [
  'text',
  'long_text',
  'number',
  'money',
  'date',
  'select',
  'multi_select',
  'person',
  'boolean',
  'file',
] as const;
export const customFieldKindSchema = z.enum(CUSTOM_FIELD_KINDS);
export type CustomFieldKind = z.infer<typeof customFieldKindSchema>;

export const CUSTOM_FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
export const customFieldKeySchema = z.string().regex(CUSTOM_FIELD_KEY_PATTERN);

/** `person`, `ticket`, `expense`: the module's own name for what the fields describe. */
export const entityTypeSchema = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);

export const fieldScopeSchema = z.object({
  moduleId: moduleIdSchema,
  entityType: entityTypeSchema,
});
export type FieldScope = z.infer<typeof fieldScopeSchema>;

export const fieldOptionSchema = z.object({
  value: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,59}$/),
  label: z.string().trim().min(1).max(80),
});
export type FieldOption = z.infer<typeof fieldOptionSchema>;

/** Money is integer minor units, so sums never round. */
export const moneyValueSchema = z.object({
  amountMinor: z.number().int().safe(),
  currency: z.string().regex(/^[A-Z]{3}$/),
});
export type MoneyValue = z.infer<typeof moneyValueSchema>;

/** Every rule is optional; only those that make sense for the kind are read. */
export const fieldValidationSchema = z
  .object({
    minLength: z.number().int().min(0).max(10_000),
    maxLength: z.number().int().min(1).max(10_000),
    /** A regular expression the whole text must match, in a shape that cannot backtrack. */
    pattern: z
      .string()
      .max(200)
      .refine((pattern) => fieldPattern(pattern) !== null, {
        error: 'Use a pattern without nested repeats or backreferences',
      }),
    min: z.number().finite(),
    max: z.number().finite(),
    /** Digits after the point for a number. */
    decimals: z.number().int().min(0).max(6),
    /** The one currency a money field takes. */
    currency: z.string().regex(/^[A-Z]{3}$/),
    minDate: z.iso.date(),
    maxDate: z.iso.date(),
    maxItems: z.number().int().min(1).max(100),
  })
  .partial();
export type FieldValidation = z.infer<typeof fieldValidationSchema>;

/** Workspace role keys; an empty list means every role. */
const roleKeysSchema = z.array(z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/)).max(50);

export const customFieldDefinitionSchema = z.object({
  id: z.uuid(),
  moduleId: moduleIdSchema,
  entityType: entityTypeSchema,
  key: customFieldKeySchema,
  label: z.string().trim().min(1).max(60),
  description: z.string().max(500).nullable(),
  kind: customFieldKindSchema,
  required: z.boolean(),
  options: z.array(fieldOptionSchema).max(500),
  validation: fieldValidationSchema,
  defaultValue: z.unknown().nullable(),
  visibleTo: roleKeysSchema,
  editableBy: roleKeysSchema,
  position: z.number().int(),
  archived: z.boolean(),
});
export type CustomFieldDefinition = z.infer<typeof customFieldDefinitionSchema>;

const definitionBody = z.object({
  key: customFieldKeySchema,
  label: z.string().trim().min(1).max(60),
  description: z.string().max(500).nullable().default(null),
  kind: customFieldKindSchema,
  required: z.boolean().default(false),
  options: z.array(fieldOptionSchema).max(500).default([]),
  validation: fieldValidationSchema.default({}),
  defaultValue: z.unknown().nullable().default(null),
  visibleTo: roleKeysSchema.default([]),
  editableBy: roleKeysSchema.default([]),
  position: z.number().int().default(0),
});

const choiceKinds: readonly CustomFieldKind[] = ['select', 'multi_select'];

export const createCustomFieldBodySchema = definitionBody
  .extend(fieldScopeSchema.shape)
  .superRefine((body, ctx) => {
    if (choiceKinds.includes(body.kind) && body.options.length === 0)
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Add at least one option' });
    const values = body.options.map((option) => option.value);
    if (new Set(values).size !== values.length)
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Option values must differ' });
  });

export type CreateCustomFieldBody = z.input<typeof createCustomFieldBodySchema>;
export type CreateCustomField = z.output<typeof createCustomFieldBodySchema>;

/** The key and kind are fixed once values exist; everything else may change. */
export const updateCustomFieldBodySchema = z
  .object({
    label: z.string().trim().min(1).max(60),
    description: z.string().max(500).nullable(),
    required: z.boolean(),
    options: z.array(fieldOptionSchema).max(500),
    validation: fieldValidationSchema,
    defaultValue: z.unknown().nullable(),
    visibleTo: roleKeysSchema,
    editableBy: roleKeysSchema,
    position: z.number().int(),
    archived: z.boolean(),
  })
  .partial();
export type UpdateCustomFieldBody = z.input<typeof updateCustomFieldBodySchema>;
export type UpdateCustomField = z.output<typeof updateCustomFieldBodySchema>;
