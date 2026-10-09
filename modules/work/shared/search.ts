import { listSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { issueKeySchema } from './common.ts';

/*
 * Keyword search over issues and the key or title prefix lookup the command
 * palette makes on every keystroke. Both answer only with issues in projects
 * the actor can open.
 */

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  projectId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const suggestQuerySchema = z.object({
  q: z.string().trim().min(1).max(60),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const searchHitSchema = z.object({
  id: z.uuid(),
  key: issueKeySchema,
  projectId: z.uuid(),
  title: z.string(),
  statusId: z.uuid(),
  typeId: z.uuid(),
  /** A fragment of the matched text with <b> around the hits; the UI renders it as marks. */
  snippet: z.string(),
  rank: z.number(),
});

export const suggestionSchema = searchHitSchema.pick({
  id: true,
  key: true,
  projectId: true,
  title: true,
  statusId: true,
  typeId: true,
});

export const searchResponseSchema = listSchema(searchHitSchema);
export const suggestResponseSchema = listSchema(suggestionSchema);

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SuggestQuery = z.infer<typeof suggestQuerySchema>;
export type SearchHit = z.infer<typeof searchHitSchema>;
export type Suggestion = z.infer<typeof suggestionSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
export type SuggestResponse = z.infer<typeof suggestResponseSchema>;
