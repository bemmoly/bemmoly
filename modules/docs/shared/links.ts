import { listSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { pageStatusSchema } from './common.ts';

/*
 * The reference graph.
 *   GET /api/v1/docs/pages/:pageId/links       what the page points at ("Linked" panel)
 *   GET /api/v1/docs/pages/:pageId/backlinks   pages that point at it (backlinks)
 *   GET /api/v1/docs/pages/:pageId/references  records of other modules that point at it,
 *                                             such as issues ("Referenced in")
 *   PUT /api/v1/docs/pages/:pageId/links       replaces the page's hand-made ("linked") edges;
 *                                             mention and embed edges come from the body
 *   GET /api/v1/docs/references?kind=issue&key=PLT-12 (or &id=)
 *                                             pages that point at a record ("Linked docs")
 * Records of other modules are resolved through the kernel's entity registry, so Docs never
 * imports Work; with Work disabled they are simply absent. Everything is filtered to what
 * the person may open.
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

/** Hand-made links only: mention and embed edges are rewritten from the body on every edit. */
export const setLinksBodySchema = z.object({
  links: z.array(linkEdgeSchema.extend({ kind: z.literal('linked').default('linked') })).max(1000),
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

/** A record another module owns (an issue), as its module describes it. */
export const linkedRecordSchema = z.object({
  kind: z.string(),
  id: z.string(),
  key: z.string().optional(),
  title: z.string(),
  path: z.string(),
});

/** An outgoing edge: a page target carries `page`, any other carries `record`. */
export const outgoingLinkSchema = linkEdgeSchema.extend({
  page: linkedPageSchema.omit({ kind: true }).nullable(),
  record: linkedRecordSchema.nullable(),
});

/** "Referenced in": a record of another module that points at the page, and how. */
export const pageReferenceSchema = linkedRecordSchema.extend({ linkKind: linkKindSchema });

export const referencesQuerySchema = z
  .object({
    kind: linkNodeKindSchema,
    id: z.uuid().optional(),
    key: z.string().trim().min(1).max(64).optional(),
  })
  .refine((query) => Boolean(query.id) !== Boolean(query.key), {
    message: 'Give the record by id or by key, not both',
  });

export const outgoingLinksResponseSchema = listSchema(outgoingLinkSchema);
export const backlinksResponseSchema = listSchema(linkedPageSchema);
export const pageReferencesResponseSchema = listSchema(pageReferenceSchema);

export type LinkNodeKind = z.infer<typeof linkNodeKindSchema>;
export type LinkKind = z.infer<typeof linkKindSchema>;
export type LinkEdge = z.infer<typeof linkEdgeSchema>;
export type SetLinksBody = z.infer<typeof setLinksBodySchema>;
export type LinkedPage = z.infer<typeof linkedPageSchema>;
export type LinkedRecord = z.infer<typeof linkedRecordSchema>;
export type OutgoingLink = z.infer<typeof outgoingLinkSchema>;
export type PageReference = z.infer<typeof pageReferenceSchema>;
export type ReferencesQuery = z.infer<typeof referencesQuerySchema>;
export type BacklinksResponse = z.infer<typeof backlinksResponseSchema>;
export type OutgoingLinksResponse = z.infer<typeof outgoingLinksResponseSchema>;
export type PageReferencesResponse = z.infer<typeof pageReferencesResponseSchema>;
