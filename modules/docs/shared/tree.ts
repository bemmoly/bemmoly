import { keysetPageSchema, keysetQuerySchema } from '@bemmoly/shared';
import { z } from 'zod';
import { pageSummarySchema } from './pages.ts';

/*
 * The page tree loads one level at a time: GET
 * /api/v1/docs/spaces/:spaceKey/tree?parentId= returns the children of a page
 * (or the roots) in sibling order, keyset-paged on (position, id) so a space
 * with thousands of pages under one parent still answers in one index scan.
 *
 * Moving: POST /api/v1/docs/pages/:pageId/move puts a page under a new parent
 * (or the root, or another space) between two siblings; the server rewrites
 * the path of the whole subtree in one statement and refuses a move into the
 * page's own subtree.
 */

export const treeQuerySchema = keysetQuerySchema.extend({
  /** Absent for the roots of the space. */
  parentId: z.uuid().optional(),
});

export const treePageSchema = keysetPageSchema(pageSummarySchema);

export const movePageBodySchema = z
  .object({
    /** Another space moves the whole subtree there; the same space when absent. */
    spaceId: z.uuid().optional(),
    parentId: z.uuid().nullable(),
    /** The sibling that ends up directly above the page; null or absent for the top. */
    afterId: z.uuid().nullable().optional(),
    /** The sibling that ends up directly below; null or absent for the end. */
    beforeId: z.uuid().nullable().optional(),
  })
  .refine((body) => !(body.afterId && body.beforeId && body.afterId === body.beforeId), {
    message: 'afterId and beforeId must differ',
  });

export const moveResultSchema = z.object({
  page: pageSummarySchema,
  /** Pages whose path was rewritten, the moved page included. */
  movedCount: z.number().int().positive(),
});

export type TreeQuery = z.infer<typeof treeQuerySchema>;
export type TreePage = z.infer<typeof treePageSchema>;
export type MovePageBody = z.infer<typeof movePageBodySchema>;
export type MoveResult = z.infer<typeof moveResultSchema>;
