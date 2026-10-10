import { hexColorSchema, listSchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { shortNameSchema, slugKeySchema } from './common.ts';
import { fieldKindSchema, issueTypeLevelSchema } from './enums.ts';

/*
 * Issue types, custom fields and the create-form layout that joins them. A
 * null projectId is an org default; originId points a project copy at the
 * default it overrides.
 */

export const issueTypeSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid().nullable(),
  originId: z.uuid().nullable(),
  key: slugKeySchema,
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  level: issueTypeLevelSchema,
  position: z.number().int(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createIssueTypeBodySchema = z.object({
  key: slugKeySchema,
  name: shortNameSchema,
  description: z.string().trim().max(500).optional(),
  /** An icon name from the design system's set, such as "rocket". */
  icon: z.string().trim().max(40).optional(),
  color: hexColorSchema.optional(),
  level: issueTypeLevelSchema.default('standard'),
  position: z.number().int().min(0).optional(),
});

export const updateIssueTypeBodySchema = createIssueTypeBodySchema
  .omit({ key: true })
  .extend({ description: z.string().trim().max(500).nullable() })
  .partial();

export const fieldOptionSchema = z.object({
  value: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(60),
  color: hexColorSchema.optional(),
});

export const fieldSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid().nullable(),
  originId: z.uuid().nullable(),
  key: slugKeySchema,
  name: z.string(),
  kind: fieldKindSchema,
  options: z.array(fieldOptionSchema),
  /** Stored now; the generated expression index arrives with the first importer. */
  filterable: z.boolean(),
  /** The model suggests a value from the title and description. */
  aiFill: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createFieldBodySchema = z.object({
  key: slugKeySchema,
  name: shortNameSchema,
  kind: fieldKindSchema,
  options: z.array(fieldOptionSchema).max(100).default([]),
  filterable: z.boolean().default(false),
  aiFill: z.boolean().default(false),
});

export const updateFieldBodySchema = createFieldBodySchema
  .omit({ key: true, kind: true })
  .partial();

/** One row of the create-form layout: the Required and On card toggles of the Workflow mock. */
export const issueTypeFieldSchema = z.object({
  id: z.uuid(),
  issueTypeId: z.uuid(),
  fieldId: z.uuid(),
  required: z.boolean(),
  onCard: z.boolean(),
  position: z.number().int(),
});

export const putIssueTypeFieldsBodySchema = z.object({
  items: z
    .array(
      z.object({
        fieldId: z.uuid(),
        required: z.boolean().default(false),
        onCard: z.boolean().default(false),
      }),
    )
    .max(100),
});

/** The whole order of a scope's types, first to last; positions follow the array. */
export const reorderIssueTypesBodySchema = z.object({ ids: z.array(z.uuid()).min(1).max(100) });

export const issueTypesResponseSchema = listSchema(issueTypeSchema);
export const fieldsResponseSchema = listSchema(fieldSchema);
export const issueTypeFieldsResponseSchema = listSchema(issueTypeFieldSchema);

export type IssueType = z.infer<typeof issueTypeSchema>;
export type CreateIssueTypeBody = z.input<typeof createIssueTypeBodySchema>;
export type UpdateIssueTypeBody = z.infer<typeof updateIssueTypeBodySchema>;
export type Field = z.infer<typeof fieldSchema>;
export type FieldOption = z.infer<typeof fieldOptionSchema>;
export type CreateFieldBody = z.input<typeof createFieldBodySchema>;
export type UpdateFieldBody = z.infer<typeof updateFieldBodySchema>;
export type IssueTypeField = z.infer<typeof issueTypeFieldSchema>;
export type PutIssueTypeFieldsBody = z.input<typeof putIssueTypeFieldsBodySchema>;
export type ReorderIssueTypesBody = z.infer<typeof reorderIssueTypesBodySchema>;
