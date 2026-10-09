import { keysetQuerySchema, listSchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { nameSchema } from './common.ts';

/** LQL text as the filter bar sends it; the parser in packages/shared validates it. */
export const lqlQuerySchema = z.string().trim().min(1).max(4000);

export const savedFilterSchema = z.object({
  id: z.uuid(),
  ownerId: z.uuid(),
  projectId: z.uuid().nullable(),
  name: z.string(),
  query: lqlQuerySchema,
  sharedWith: z.array(z.uuid()),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createSavedFilterBodySchema = z.object({
  name: nameSchema,
  query: lqlQuerySchema,
  projectId: z.uuid().optional(),
  /** Team ids the filter is shared with. */
  sharedWith: z.array(z.uuid()).max(50).default([]),
});

export const updateSavedFilterBodySchema = z
  .object({
    name: nameSchema,
    query: lqlQuerySchema,
    projectId: z.uuid().nullable(),
    sharedWith: z.array(z.uuid()).max(50),
  })
  .partial();

/** `GET /work/filters`: the filters the caller sees, optionally for one project (key or id). */
export const listSavedFiltersQuerySchema = z.object({
  projectId: z.string().trim().min(1).max(64).optional(),
  /** "mine" are the caller's own, "shared" those other people shared with their teams. */
  scope: z.enum(['all', 'mine', 'shared']).default('all'),
});

export const savedFiltersResponseSchema = listSchema(savedFilterSchema);

/** `GET /work/issues/query`: a page of issues for an LQL query, scoped to a project when given. */
export const issueQueryParamsSchema = keysetQuerySchema.extend({
  lql: z.string().trim().max(4000).default(''),
  projectId: z.uuid().optional(),
});

export type IssueQueryParams = z.infer<typeof issueQueryParamsSchema>;

export type SavedFilter = z.infer<typeof savedFilterSchema>;
export type CreateSavedFilterBody = z.input<typeof createSavedFilterBodySchema>;
export type UpdateSavedFilterBody = z.infer<typeof updateSavedFilterBodySchema>;
export type ListSavedFiltersQuery = z.infer<typeof listSavedFiltersQuerySchema>;
