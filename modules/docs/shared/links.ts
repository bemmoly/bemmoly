import { listSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { pageStatusSchema } from './common.ts';

/*
 * The reference graph: GET /api/v1/docs/pages/:pageId/links (what the page
 * points at) and GET /api/v1/docs/pages/:pageId/backlinks (pages that point
 * at it, the "Referenced in" panel). PUT /api/v1/docs/pages/:pageId/links
 * replaces a page's outgoing edges; the collab hook calls the service
 * directly, the route exists for importers and tests. GET
 * /api/v1/docs/references?kind=issue&id= answers "Referenced in" for an
 * issue without Docs knowing anything else about Work.
 */

export const LINK_NODE_KINDS = ['page', 'issue'] as const;
export const LINK_KINDS = ['mention', 'embed', 'linked'] as const;

export const linkNodeKindSchema = z.enum(LINK_NODE_KINDS);
export const linkKindSchema = z.enum(LINK_KINDS);

export const linkEdgeSchema = z.object({
  targetKind: linkNodeKindSchema,
  targetId: z.uuid(),
  kind: linkKindSchema,
});

export const setLinksBodySchema = z.object({
  links: z.array(linkEdgeSchema).max(1000),
});

/** One page on the other end of an edge, with only what the panel shows. */
export const linkedPageSchema = z.object({
  pageId: z.uuid(),
  spaceKey: z.string(),
  title: z.string(),
  icon: z.string().nullable(),
  status: pageStatusSchema,
  kind: linkKindSchema,
});

/** An outgoing edge; pages are resolved, issues stay ids for Work's hooks to fetch. */
export const outgoingLinkSchema = linkEdgeSchema.extend({
  page: linkedPageSchema.omit({ kind: true }).nullable(),
});

export const referencesQuerySchema = z.object({
  kind: linkNodeKindSchema,
  id: z.uuid(),
});

export const outgoingLinksResponseSchema = listSchema(outgoingLinkSchema);
export const backlinksResponseSchema = listSchema(linkedPageSchema);

export type LinkNodeKind = z.infer<typeof linkNodeKindSchema>;
export type LinkKind = z.infer<typeof linkKindSchema>;
export type LinkEdge = z.infer<typeof linkEdgeSchema>;
export type SetLinksBody = z.infer<typeof setLinksBodySchema>;
export type LinkedPage = z.infer<typeof linkedPageSchema>;
export type OutgoingLink = z.infer<typeof outgoingLinkSchema>;
export type ReferencesQuery = z.infer<typeof referencesQuerySchema>;
export type BacklinksResponse = z.infer<typeof backlinksResponseSchema>;
export type OutgoingLinksResponse = z.infer<typeof outgoingLinksResponseSchema>;
