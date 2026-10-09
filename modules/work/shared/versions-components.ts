import { keysetPageSchema, keysetQuerySchema, listSchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { shortNameSchema } from './common.ts';
import { versionStatusSchema } from './enums.ts';
import { namePrefixSchema } from './links-labels.ts';

export const versionSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  releaseAt: z.iso.date().nullable(),
  status: versionStatusSchema,
  releasedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createVersionBodySchema = z.object({
  name: shortNameSchema,
  description: z.string().trim().max(500).optional(),
  releaseAt: z.iso.date().optional(),
});

export const updateVersionBodySchema = z
  .object({
    name: shortNameSchema,
    description: z.string().trim().max(500).nullable(),
    releaseAt: z.iso.date().nullable(),
    status: versionStatusSchema,
  })
  .partial();

export const componentSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  leadUserId: z.uuid().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createComponentBodySchema = z.object({
  name: shortNameSchema,
  description: z.string().trim().max(500).optional(),
  leadUserId: z.uuid().optional(),
});

export const updateComponentBodySchema = z
  .object({
    name: shortNameSchema,
    description: z.string().trim().max(500).nullable(),
    leadUserId: z.uuid().nullable(),
  })
  .partial();

export const versionsResponseSchema = listSchema(versionSchema);
export const componentsResponseSchema = listSchema(componentSchema);
/** Pages by name, then id; `q` keeps the names that start with it, as pickers ask. */
export const listVersionsQuerySchema = keysetQuerySchema.extend({
  q: namePrefixSchema.optional(),
  status: versionStatusSchema.optional(),
});
export const versionsPageSchema = keysetPageSchema(versionSchema);
export const listComponentsQuerySchema = keysetQuerySchema.extend({
  q: namePrefixSchema.optional(),
});
export const componentsPageSchema = keysetPageSchema(componentSchema);
export type ListVersionsQuery = z.infer<typeof listVersionsQuerySchema>;
export type VersionsPage = z.infer<typeof versionsPageSchema>;
export type ListComponentsQuery = z.infer<typeof listComponentsQuerySchema>;
export type ComponentsPage = z.infer<typeof componentsPageSchema>;

export type Version = z.infer<typeof versionSchema>;
export type CreateVersionBody = z.infer<typeof createVersionBodySchema>;
export type UpdateVersionBody = z.infer<typeof updateVersionBodySchema>;
export type Component = z.infer<typeof componentSchema>;
export type CreateComponentBody = z.infer<typeof createComponentBodySchema>;
export type UpdateComponentBody = z.infer<typeof updateComponentBodySchema>;
