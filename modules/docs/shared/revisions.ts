import { keysetPageSchema, keysetQuerySchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { richTextSchema } from './common.ts';
import { docDiffSchema } from './diff/types.ts';

/*
 * Version history: GET /api/v1/docs/pages/:pageId/revisions (newest first,
 * keyset paginated), GET .../revisions/:revisionId with the snapshot, POST
 * .../revisions to save the current state as a version (optionally named),
 * POST .../revisions/:revisionId/restore to make a revision the page's content
 * again through the live document (which itself writes a "restore" revision),
 * and GET .../revisions/compare?from=&to= for the structural diff of two
 * revisions, or of one revision and the page as it is now (to=current).
 */

export const REVISION_KINDS = ['named', 'periodic', 'publish', 'restore'] as const;
export const revisionKindSchema = z.enum(REVISION_KINDS);

export const revisionSummarySchema = z.object({
  id: z.uuid(),
  pageId: z.uuid(),
  number: z.number().int().positive(),
  kind: revisionKindSchema,
  label: z.string().nullable(),
  title: z.string(),
  wordCount: z.number().int().nonnegative(),
  authorIds: z.array(z.uuid()),
  createdBy: z.uuid().nullable(),
  createdAt: timestampSchema,
});

export const revisionDetailSchema = revisionSummarySchema.extend({
  snapshot: richTextSchema,
});

export const listRevisionsQuerySchema = keysetQuerySchema;

export const createRevisionBodySchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
});

/** The page as it is now, on either side of a compare. */
export const CURRENT_REVISION = 'current';

export const compareRevisionsQuerySchema = z.object({
  from: z.union([z.uuid(), z.literal(CURRENT_REVISION)]),
  to: z.union([z.uuid(), z.literal(CURRENT_REVISION)]).default(CURRENT_REVISION),
});

/** One side of a compare: a revision's summary, or null for the page as it is now. */
export const compareSideSchema = z.object({
  revision: revisionSummarySchema.nullable(),
  title: z.string(),
});

export const revisionCompareSchema = z.object({
  pageId: z.uuid(),
  from: compareSideSchema,
  to: compareSideSchema,
  diff: docDiffSchema,
});

export const revisionParamsSchema = z.object({
  pageId: z.uuid(),
  revisionId: z.uuid(),
});

export const revisionsPageSchema = keysetPageSchema(revisionSummarySchema);

export type RevisionKind = z.infer<typeof revisionKindSchema>;
export type RevisionSummary = z.infer<typeof revisionSummarySchema>;
export type RevisionDetail = z.infer<typeof revisionDetailSchema>;
export type ListRevisionsQuery = z.infer<typeof listRevisionsQuerySchema>;
export type CreateRevisionBody = z.infer<typeof createRevisionBodySchema>;
export type RevisionsPage = z.infer<typeof revisionsPageSchema>;
export type CompareRevisionsQuery = z.infer<typeof compareRevisionsQuerySchema>;
export type RevisionCompare = z.infer<typeof revisionCompareSchema>;
