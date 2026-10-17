import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from './common.ts';

/*
 * A person's own views of a list: GET /api/v1/pipelines/views?screen=catalog,
 * POST /views, DELETE /views/:id. A view is a name and the list's filters as the address
 * holds them, so opening one is setting the address.
 */

export const savedViewScreenSchema = z.enum(['catalog', 'runs', 'releases']);

/** The filters as the address writes them: strings, lists joined with commas. */
export const savedViewQuerySchema = z
  .record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,31}$/), z.string().max(500))
  .refine((query) => Object.keys(query).length <= 20, 'A view holds at most 20 filters');

export const savedViewSchema = z.object({
  id: idSchema,
  name: z.string(),
  screen: savedViewScreenSchema,
  query: z.record(z.string(), z.string()),
  createdAt: isoDateTimeSchema,
});

export const listSavedViewsQuerySchema = z.object({ screen: savedViewScreenSchema });

export const savedViewsResponseSchema = z.object({ items: z.array(savedViewSchema) });

export const createSavedViewBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  screen: savedViewScreenSchema,
  query: savedViewQuerySchema,
});

export const savedViewParamsSchema = z.object({ id: idSchema });

/** How many views one person keeps per screen. */
export const SAVED_VIEWS_LIMIT = 30;

export type SavedViewScreen = z.infer<typeof savedViewScreenSchema>;
export type SavedView = z.infer<typeof savedViewSchema>;
export type SavedViewsResponse = z.infer<typeof savedViewsResponseSchema>;
export type CreateSavedViewBody = z.infer<typeof createSavedViewBodySchema>;
