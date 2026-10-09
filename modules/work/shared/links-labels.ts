import {
  hexColorSchema,
  keysetPageSchema,
  keysetQuerySchema,
  listSchema,
  timestampSchema,
} from '@bemmoly/shared';
import { z } from 'zod';
import { shortNameSchema } from './common.ts';
import { issueLinkKindSchema } from './enums.ts';

export const issueLinkSchema = z.object({
  id: z.uuid(),
  sourceId: z.uuid(),
  targetId: z.uuid(),
  kind: issueLinkKindSchema,
  createdBy: z.uuid().nullable(),
  createdAt: timestampSchema,
});

export const createIssueLinkBodySchema = z
  .object({
    targetId: z.uuid(),
    kind: issueLinkKindSchema,
    /** True when the issue is the target: "is blocked by" rather than "blocks". */
    inverse: z.boolean().default(false),
  })
  .strict();

export const labelSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  name: z.string(),
  color: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createLabelBodySchema = z.object({
  name: shortNameSchema,
  color: hexColorSchema.optional(),
});

export const updateLabelBodySchema = z
  .object({ name: shortNameSchema, color: hexColorSchema.nullable() })
  .partial();

export const issueLinksResponseSchema = listSchema(issueLinkSchema);
export const labelsResponseSchema = listSchema(labelSchema);
/**
 * What a picker types: the start of a name, matched case-insensitively. The
 * create form and the issue page send it on every keystroke and show the
 * first page, which is fifty names unless they ask for fewer.
 */
export const namePrefixSchema = z.string().trim().min(1).max(60);

/** Labels page by name, then id; `q` keeps the names that start with it. */
export const listLabelsQuerySchema = keysetQuerySchema.extend({ q: namePrefixSchema.optional() });
export const labelsPageSchema = keysetPageSchema(labelSchema);
export type ListLabelsQuery = z.infer<typeof listLabelsQuerySchema>;
export type LabelsPage = z.infer<typeof labelsPageSchema>;

export type IssueLink = z.infer<typeof issueLinkSchema>;
export type CreateIssueLinkBody = z.input<typeof createIssueLinkBodySchema>;
export type Label = z.infer<typeof labelSchema>;
export type CreateLabelBody = z.infer<typeof createLabelBodySchema>;
export type UpdateLabelBody = z.infer<typeof updateLabelBodySchema>;
