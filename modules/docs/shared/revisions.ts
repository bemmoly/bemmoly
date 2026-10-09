import { keysetPageSchema, keysetQuerySchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { richTextSchema } from './common.ts';

/*
 * Version history: GET /api/v1/docs/pages/:pageId/revisions (newest first),
 * GET .../revisions/:revisionId with the snapshot, POST .../revisions to name
 * the current state, POST .../revisions/:revisionId/restore to make a
 * revision the page's content again (which itself writes a "restore" one).
 * Diffing two revisions is the client's job and arrives with the editor.
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
  label: z.string().trim().min(1).max(120),
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
