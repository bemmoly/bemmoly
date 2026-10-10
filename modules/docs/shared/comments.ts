import { listSchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { docsPersonSchema, richTextSchema } from './common.ts';

/*
 * Page comments: GET/POST /api/v1/docs/pages/:pageId/comments,
 * PATCH/DELETE /api/v1/docs/comments/:commentId, POST .../resolve,
 * .../reopen and .../apply-suggestion. An inline comment carries an anchor
 * (Yjs relative positions plus the quoted text so it survives edits); a
 * page-level one does not. Listing resolves each anchor against the page as
 * it is now: "anchored" when the quoted text is still there, "text_changed"
 * when it was edited or deleted, and the UI falls back to the quote. Threads
 * are one level deep. Mentions in a comment notify the person named.
 */

export const commentAnchorSchema = z.object({
  /** Base64 of the Yjs RelativePosition pair; opaque to the server. */
  from: z.string().min(1).max(2000),
  to: z.string().min(1).max(2000),
  quote: z.string().max(2000),
});

/**
 * A proposed fix on an inline thread: replace the anchored text (which must
 * still read as the anchor's quote) with `replacement`. Applied through the
 * live document, never as a raw write. Written by the AI runtime from 0.4.
 */
export const aiSuggestionSchema = z.object({
  replacement: z.string().max(10_000),
  rationale: z.string().max(2000).optional(),
  runId: z.uuid().optional(),
  appliedAt: timestampSchema.nullable().optional(),
  appliedBy: z.uuid().nullable().optional(),
});

export const ANCHOR_STATUSES = ['anchored', 'text_changed'] as const;
export const anchorStatusSchema = z.enum(ANCHOR_STATUSES);

export const pageCommentSchema = z.object({
  id: z.uuid(),
  pageId: z.uuid(),
  parentId: z.uuid().nullable(),
  author: docsPersonSchema.nullable(),
  body: richTextSchema,
  bodyText: z.string(),
  anchor: commentAnchorSchema.nullable(),
  /** Where the anchor stands in the page now; null for a page-level comment. */
  anchorStatus: anchorStatusSchema.nullable(),
  aiSuggestion: aiSuggestionSchema.nullable(),
  resolvedAt: timestampSchema.nullable(),
  resolvedBy: z.uuid().nullable(),
  editedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
});

export const listCommentsQuerySchema = z.object({
  /** Open threads only when false; the Docs editor's sidebar default. */
  resolved: z.union([z.boolean(), z.stringbool()]).optional(),
});

export const createCommentBodySchema = z.object({
  body: richTextSchema,
  parentId: z.uuid().optional(),
  anchor: commentAnchorSchema.optional(),
});

export const updateCommentBodySchema = z.object({ body: richTextSchema });

export const commentIdParamsSchema = z.object({ commentId: z.uuid() });

export const commentsResponseSchema = listSchema(pageCommentSchema);

export type CommentAnchor = z.infer<typeof commentAnchorSchema>;
export type AiSuggestion = z.infer<typeof aiSuggestionSchema>;
export type AnchorStatus = z.infer<typeof anchorStatusSchema>;
export type PageComment = z.infer<typeof pageCommentSchema>;
export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;
export type CreateCommentBody = z.infer<typeof createCommentBodySchema>;
export type UpdateCommentBody = z.infer<typeof updateCommentBodySchema>;
export type CommentsResponse = z.infer<typeof commentsResponseSchema>;
