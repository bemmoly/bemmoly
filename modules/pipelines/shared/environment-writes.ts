import { z } from 'zod';
import {
  deployRuntimeSchema,
  environmentClassSchema,
  idSchema,
  providerSchema,
  slugSchema,
  tierQuerySchema,
} from './common.ts';

/*
 * Creating environments and setting paths: POST /environments, PATCH and DELETE
 * /environments/:key, and PUT /environments/paths/:tier. An environment points at one cloud
 * account (an attached or created project) and a region; a path says which environments a
 * tier's releases cross, stage by stage.
 */

const regionSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]{2,40}$/, 'Name a region such as us-central1');

/**
 * What an edit or a create may say about protection. No defaults here: a field left out keeps
 * what the environment had (zod 4 keeps defaults inside partial objects).
 */
const protectionPatchSchema = z
  .object({
    protected: z.boolean(),
    controlPlaneOnly: z.boolean(),
    requiresApproval: z.boolean(),
    window: z.string().max(120).nullable(),
  })
  .partial();

export const createEnvironmentBodySchema = z.object({
  key: slugSchema,
  name: z.string().trim().min(1).max(80),
  class: environmentClassSchema,
  provider: providerSchema.default('gcp'),
  /** The project it deploys into; null until one is chosen. */
  cloudAccountId: idSchema.nullable().default(null),
  /** The connection's region when null. */
  region: regionSchema.nullable().default(null),
  /** Left to right; after the last environment when left out. */
  position: z.number().int().min(0).max(10_000).optional(),
  protection: protectionPatchSchema.optional(),
  /** Cloud Run when left out. */
  defaultRuntime: deployRuntimeSchema.optional(),
});

/** Only what is sent changes; every field is optional and none has a default. */
export const updateEnvironmentBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    class: environmentClassSchema,
    cloudAccountId: idSchema.nullable(),
    region: regionSchema.nullable(),
    position: z.number().int().min(0).max(10_000),
    protection: protectionPatchSchema,
    defaultRuntime: deployRuntimeSchema,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Change at least one thing');

export const pathStepBodySchema = z.object({
  environmentId: idSchema,
  /** Environments sharing a stage roll out together. */
  stage: z.number().int().min(0).max(50),
  bakeMinutes: z
    .number()
    .int()
    .min(0)
    .max(7 * 24 * 60)
    .default(0),
  autoPromote: z.boolean().default(false),
});

export const setPathBodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  steps: z
    .array(pathStepBodySchema)
    .min(1)
    .max(30)
    .refine(
      (steps) => new Set(steps.map((step) => step.environmentId)).size === steps.length,
      'An environment appears once on a path',
    ),
});

export const pathParamsSchema = z.object({ tier: tierQuerySchema });

export type CreateEnvironmentBody = z.input<typeof createEnvironmentBodySchema>;
export type UpdateEnvironmentBody = z.input<typeof updateEnvironmentBodySchema>;
export type SetPathBody = z.input<typeof setPathBodySchema>;
