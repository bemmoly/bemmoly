import { keysetPageSchema, keysetQuerySchema } from '@bemmoly/shared';
import { z } from 'zod';
import { pageSummarySchema } from './pages.ts';

/*
 * The Docs home's lists: GET /api/v1/docs/home/recent (pages updated most
 * recently in spaces the actor can open) and GET /api/v1/docs/home/starred
 * (the actor's stars, newest first). Both are keyset paged.
 */

export const recentPagesQuerySchema = keysetQuerySchema.extend({
  /** Only pages this person last edited or owns. */
  mine: z.union([z.boolean(), z.stringbool()]).default(false),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const starredPagesQuerySchema = keysetQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const homePagesSchema = keysetPageSchema(pageSummarySchema);

export type RecentPagesQuery = z.infer<typeof recentPagesQuerySchema>;
export type StarredPagesQuery = z.infer<typeof starredPagesQuerySchema>;
export type HomePages = z.infer<typeof homePagesSchema>;
