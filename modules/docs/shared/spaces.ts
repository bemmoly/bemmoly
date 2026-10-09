import { keysetPageSchema, keysetQuerySchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { iconSchema, nameSchema, queryFlagSchema, spaceKeySchema } from './common.ts';

/*
 * Spaces: GET/POST /api/v1/docs/spaces, GET/PATCH/DELETE
 * /api/v1/docs/spaces/:spaceKey. A space is addressed by its key in URLs, as
 * a project is, and by id in rows that point at it.
 */

export const spaceSchema = z.object({
  id: z.uuid(),
  key: spaceKeySchema,
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  teamId: z.uuid().nullable(),
  /** Set only for a project space; Docs never dereferences it, so Work may be off. */
  projectId: z.uuid().nullable(),
  /** Never sent to an AI provider, and never embedded. */
  aiExcluded: z.boolean(),
  homePageId: z.uuid().nullable(),
  /** Live pages in the space, for the Docs home's space cards. */
  pageCount: z.number().int().nonnegative(),
  archivedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createSpaceBodySchema = z.object({
  key: spaceKeySchema,
  name: nameSchema,
  description: z.string().trim().max(2000).optional(),
  icon: iconSchema.optional(),
  color: z.string().trim().max(20).optional(),
  teamId: z.uuid().optional(),
  projectId: z.uuid().optional(),
  aiExcluded: z.boolean().default(false),
});

export const updateSpaceBodySchema = z
  .object({
    name: nameSchema,
    description: z.string().trim().max(2000).nullable(),
    icon: iconSchema.nullable(),
    color: z.string().trim().max(20).nullable(),
    teamId: z.uuid().nullable(),
    aiExcluded: z.boolean(),
    homePageId: z.uuid().nullable(),
    archived: z.boolean(),
  })
  .partial();

export const listSpacesQuerySchema = keysetQuerySchema.extend({
  teamId: z.uuid().optional(),
  archived: queryFlagSchema.default(false),
});

export const spacesPageSchema = keysetPageSchema(spaceSchema);

export type Space = z.infer<typeof spaceSchema>;
export type CreateSpaceBody = z.input<typeof createSpaceBodySchema>;
export type UpdateSpaceBody = z.infer<typeof updateSpaceBodySchema>;
export type ListSpacesQuery = z.infer<typeof listSpacesQuerySchema>;
export type SpacesPage = z.infer<typeof spacesPageSchema>;
