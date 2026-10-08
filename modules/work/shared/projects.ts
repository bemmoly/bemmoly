import { keysetPageSchema, keysetQuerySchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { workMethodSchema } from './enums.ts';

/** Two to ten capitals or digits, starting with a letter, as in "PLT-142". */
export const projectKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9]{1,9}$/, 'Keys are 2 to 10 capital letters or digits');

export const projectSchema = z.object({
  id: z.uuid(),
  key: projectKeySchema,
  name: z.string(),
  description: z.string().nullable(),
  teamId: z.uuid().nullable(),
  method: workMethodSchema,
  /** Which org defaults this project overrides; feeds the "view diff" controls. */
  schemeOverrides: z.record(z.string(), z.unknown()),
  defaultSpaceId: z.uuid().nullable(),
  archivedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createProjectBodySchema = z.object({
  key: projectKeySchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  teamId: z.uuid().optional(),
  method: workMethodSchema.default('scrum'),
});

export const updateProjectBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).nullable(),
    teamId: z.uuid().nullable(),
    method: workMethodSchema,
    defaultSpaceId: z.uuid().nullable(),
  })
  .partial();

export const projectKeyParamsSchema = z.object({ key: projectKeySchema });

export const listProjectsQuerySchema = keysetQuerySchema.extend({
  teamId: z.uuid().optional(),
  archived: z.coerce.boolean().default(false),
});

export const projectsPageSchema = keysetPageSchema(projectSchema);

export type Project = z.infer<typeof projectSchema>;
export type CreateProjectBody = z.input<typeof createProjectBodySchema>;
export type UpdateProjectBody = z.infer<typeof updateProjectBodySchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
export type ProjectsPage = z.infer<typeof projectsPageSchema>;
