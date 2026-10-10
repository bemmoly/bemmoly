import { keysetPageSchema, keysetQuerySchema } from '@bemmoly/shared';
import { z } from 'zod';
import { docsPersonSchema } from './common.ts';
import { breadcrumbSchema, pageSummarySchema } from './pages.ts';

/*
 * The Docs home's lists: GET /api/v1/docs/home/recent (pages updated most
 * recently in spaces the actor can open) and GET /api/v1/docs/home/starred
 * (the actor's stars, newest first). Both are keyset paged.
 */

export const recentPagesQuerySchema = keysetQuerySchema.extend({
  /** Only pages this person last edited or owns. */
  mine: z.union([z.boolean(), z.stringbool()]).default(false),
  /** Only pages in this space, for its overview. */
  spaceId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const starredPagesQuerySchema = keysetQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * A page as the Docs home's lists show it. The extra fields default, so a
 * server or mock that does not send them still parses.
 */
export const homePageSchema = pageSummarySchema.extend({
  /** The page's ancestors, root first, for "Engineering / Architecture"; empty at the root. */
  ancestors: z.array(breadcrumbSchema).default([]),
  /** Who last changed the body (the creator until someone edits it), not the owner. */
  lastEditor: docsPersonSchema.nullable().default(null),
  /** Keys of the issues the page embeds or links that the person may open; empty with Work off. */
  issueKeys: z.array(z.string()).default([]),
});

export const homePagesSchema = keysetPageSchema(homePageSchema);

export type RecentPagesQuery = z.infer<typeof recentPagesQuerySchema>;
export type StarredPagesQuery = z.infer<typeof starredPagesQuerySchema>;
export type HomePage = z.infer<typeof homePageSchema>;
export type HomePages = z.infer<typeof homePagesSchema>;
