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
/** Labels page by id; the response is a superset of the plain list. */
export const listLabelsQuerySchema = keysetQuerySchema;
export const labelsPageSchema = keysetPageSchema(labelSchema);
export type ListLabelsQuery = z.infer<typeof listLabelsQuerySchema>;
export type LabelsPage = z.infer<typeof labelsPageSchema>;

export type IssueLink = z.infer<typeof issueLinkSchema>;
export type CreateIssueLinkBody = z.input<typeof createIssueLinkBodySchema>;
export type Label = z.infer<typeof labelSchema>;
export type CreateLabelBody = z.infer<typeof createLabelBodySchema>;
export type UpdateLabelBody = z.infer<typeof updateLabelBodySchema>;
