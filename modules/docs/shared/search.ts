import { listSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { pageStatusSchema } from './common.ts';

/*
 * Keyword search over pages (GET /api/v1/docs/search) and the title prefix
 * lookup the command palette makes on every keystroke
 * (GET /api/v1/docs/search/suggest). Both answer only with pages in spaces
 * the actor can open, and never with pages in the trash.
 */

export const searchPagesQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  spaceId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const suggestPagesQuerySchema = z.object({
  q: z.string().trim().min(1).max(60),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const pageSearchHitSchema = z.object({
  id: z.uuid(),
  spaceId: z.uuid(),
  spaceKey: z.string(),
  title: z.string(),
  icon: z.string().nullable(),
  status: pageStatusSchema,
  /** A fragment of the matched text with <b> around the hits; the UI renders it as marks. */
  snippet: z.string(),
  rank: z.number(),
});

export const pageSuggestionSchema = pageSearchHitSchema.omit({ snippet: true, rank: true });

export const pageSearchResponseSchema = listSchema(pageSearchHitSchema);
export const pageSuggestResponseSchema = listSchema(pageSuggestionSchema);

export type SearchPagesQuery = z.infer<typeof searchPagesQuerySchema>;
export type SuggestPagesQuery = z.infer<typeof suggestPagesQuerySchema>;
export type PageSearchHit = z.infer<typeof pageSearchHitSchema>;
export type PageSuggestion = z.infer<typeof pageSuggestionSchema>;
export type PageSearchResponse = z.infer<typeof pageSearchResponseSchema>;
export type PageSuggestResponse = z.infer<typeof pageSuggestResponseSchema>;
