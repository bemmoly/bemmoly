import { listSchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import {
  docsPersonSchema,
  iconSchema,
  nameSchema,
  pageTitleSchema,
  richTextSchema,
} from './common.ts';

/*
 * Templates: GET /api/v1/docs/templates?spaceId= lists the org templates plus
 * the space's own; POST/PATCH/DELETE manage them (spaceId null is org-wide);
 * POST /api/v1/docs/templates/:templateId/pages creates a page from one.
 * Settings › Docs manages the org-wide ones: GET /api/v1/docs/org-templates
 * lists them with the archived, PUT /api/v1/docs/org-templates/order sets
 * their order, and POST …/templates/:templateId/{archive,restore,duplicate}.
 */

export const templateFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  label: z.string().min(1).max(60),
  kind: z.enum(['text', 'user', 'users', 'date', 'select']),
  options: z.array(z.string().min(1).max(60)).max(20).optional(),
});

export const templateSummarySchema = z.object({
  id: z.uuid(),
  spaceId: z.uuid().nullable(),
  key: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  category: z.string().nullable(),
  fields: z.array(templateFieldSchema),
  isBuiltin: z.boolean(),
  position: z.number().int(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const templateDetailSchema = templateSummarySchema.extend({
  snapshot: richTextSchema,
});

export const listTemplatesQuerySchema = z.object({
  spaceId: z.uuid().optional(),
});

export const createTemplateBodySchema = z.object({
  /** The space the template belongs to; null makes it org-wide (Settings › Docs). */
  spaceId: z.uuid().nullable(),
  name: nameSchema,
  description: z.string().trim().max(500).optional(),
  icon: iconSchema.optional(),
  category: z.string().trim().max(40).optional(),
  snapshot: richTextSchema,
  fields: z.array(templateFieldSchema).max(20).default([]),
});

export const updateTemplateBodySchema = createTemplateBodySchema
  .omit({ spaceId: true })
  .partial()
  .extend({ description: z.string().trim().max(500).nullable().optional() });

export const createFromTemplateBodySchema = z.object({
  spaceId: z.uuid(),
  parentId: z.uuid().nullable().default(null),
  title: pageTitleSchema.optional(),
});

export const templatesResponseSchema = listSchema(templateSummarySchema);

/** An org template as Settings › Docs lists it: how often it was used, who made it, archived. */
export const orgTemplateSchema = templateSummarySchema.extend({
  /** Pages made from it, trashed ones included. */
  usedBy: z.number().int().nonnegative(),
  createdBy: docsPersonSchema.nullable(),
  archivedAt: timestampSchema.nullable(),
});

export const orgTemplatesResponseSchema = listSchema(orgTemplateSchema);

/** The org templates' new order, every active one exactly once, first to last. */
export const reorderTemplatesBodySchema = z.object({
  ids: z.array(z.uuid()).min(1).max(500),
});

export const templateIdParamsSchema = z.object({ templateId: z.uuid() });

export type TemplateField = z.infer<typeof templateFieldSchema>;
export type TemplateSummary = z.infer<typeof templateSummarySchema>;
export type TemplateDetail = z.infer<typeof templateDetailSchema>;
export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>;
export type CreateTemplateBody = z.input<typeof createTemplateBodySchema>;
export type UpdateTemplateBody = z.infer<typeof updateTemplateBodySchema>;
export type CreateFromTemplateBody = z.input<typeof createFromTemplateBodySchema>;
export type TemplatesResponse = z.infer<typeof templatesResponseSchema>;
export type OrgTemplate = z.infer<typeof orgTemplateSchema>;
export type OrgTemplatesResponse = z.infer<typeof orgTemplatesResponseSchema>;
export type ReorderTemplatesBody = z.infer<typeof reorderTemplatesBodySchema>;
