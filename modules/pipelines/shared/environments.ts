import { z } from 'zod';
import {
  environmentClassSchema,
  idSchema,
  keysetPageSchema,
  keysetQuerySchema,
  providerSchema,
  slugSchema,
  tierSchema,
} from './common.ts';

/*
 * Environments and the paths releases take through them:
 * GET /api/v1/pipelines/environments and /environments/paths.
 */

/** What an environment asks of anyone deploying to it, before any policy adds more. */
export const environmentProtectionSchema = z.object({
  /** Production is marked with a shield and the word "Protected". */
  protected: z.boolean().default(false),
  /** Runners never deploy here; only the control plane, as the environment's deployer. */
  controlPlaneOnly: z.boolean().default(false),
  requiresApproval: z.boolean().default(false),
  /** "Mon-Thu 10:00-16:00 Asia/Kolkata", as policies write windows. */
  window: z.string().max(120).nullable().default(null),
});

export const environmentSchema = z.object({
  id: idSchema,
  key: slugSchema,
  /** "Prod · asia-south1". */
  name: z.string(),
  class: environmentClassSchema,
  provider: providerSchema,
  region: z.string().nullable(),
  /** Left to right on every screen that lays environments out. */
  position: z.number().int(),
  cloudAccount: z.object({ id: idSchema, externalId: z.string(), name: z.string() }).nullable(),
  protection: environmentProtectionSchema,
});

export const environmentRefSchema = z.object({
  id: idSchema,
  key: slugSchema,
  name: z.string(),
  class: environmentClassSchema,
});

export const environmentsResponseSchema = z.object({ items: z.array(environmentSchema) });

/** One environment on a tier's path; environments sharing a stage roll out together. */
export const pathStepSchema = z.object({
  environment: environmentRefSchema,
  stage: z.number().int().min(0),
  bakeMinutes: z.number().int().min(0),
  autoPromote: z.boolean(),
});

export const environmentPathSchema = z.object({
  id: idSchema,
  tier: tierSchema,
  name: z.string(),
  steps: z.array(pathStepSchema),
});

export const environmentPathsResponseSchema = z.object({ items: z.array(environmentPathSchema) });

export const environmentKeyParamsSchema = z.object({ key: slugSchema });

/** Kernel teams as Pipelines shows them: GET /api/v1/pipelines/teams. */
export const pipelinesTeamSchema = z.object({
  id: idSchema,
  name: z.string(),
  memberCount: z.number().int(),
  applicationCount: z.number().int(),
  /** Whether the person asking is in it, for "My teams". */
  mine: z.boolean(),
});

export const listTeamsQuerySchema = keysetQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  mine: z.stringbool().optional(),
});

export const teamsPageSchema = keysetPageSchema(pipelinesTeamSchema);

export type EnvironmentProtection = z.infer<typeof environmentProtectionSchema>;
export type Environment = z.infer<typeof environmentSchema>;
export type EnvironmentRef = z.infer<typeof environmentRefSchema>;
export type EnvironmentsResponse = z.infer<typeof environmentsResponseSchema>;
export type PathStep = z.infer<typeof pathStepSchema>;
export type EnvironmentPath = z.infer<typeof environmentPathSchema>;
export type EnvironmentPathsResponse = z.infer<typeof environmentPathsResponseSchema>;
export type PipelinesTeam = z.infer<typeof pipelinesTeamSchema>;
export type ListTeamsQuery = z.infer<typeof listTeamsQuerySchema>;
export type TeamsPage = z.infer<typeof teamsPageSchema>;
