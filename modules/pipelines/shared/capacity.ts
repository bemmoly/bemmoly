import { z } from 'zod';
import {
  glyphStateSchema,
  idSchema,
  isoDateTimeSchema,
  slugSchema,
  teamRefSchema,
} from './common.ts';
import { cloudBuildPoolBodySchema, cloudBuildPoolSchema, poolMachineSchema } from './machines.ts';

/*
 * Platform › Capacity: GET /api/v1/pipelines/capacity?range=now|7d|30d, GET/POST/PATCH
 * /pools, PUT /pools/:key/shares/:teamId. Runner pools and how busy they are, the queue and
 * why it waits, each team's fair share, and the build minutes the cloud will bill.
 */

export const poolHostingSchema = z.enum(['kubernetes', 'vm', 'local', 'cloud-build', 'codebuild']);

export const runnerPoolSchema = z.object({
  id: idSchema,
  key: slugSchema,
  name: z.string(),
  hosting: poolHostingSchema,
  /** "GKE Autopilot · asia-south1". */
  location: z.string().nullable(),
  labels: z.array(z.string()),
  busy: z.number().int().min(0),
  max: z.number().int().min(0),
  minRunners: z.number().int().min(0),
  maxRunners: z.number().int().min(0),
  warmRunners: z.number().int().min(0),
  /** "40 to 240 pods", "0 to 30, at limit". */
  scaling: z.string(),
  atLimit: z.boolean(),
  queued: z.number().int().min(0),
  /** How a Cloud Build pool starts its builds; null for every other hosting. */
  cloudBuild: cloudBuildPoolSchema.nullable(),
  /** Machines Pipelines started for this pool's jobs that are still starting or running. */
  machines: z.array(poolMachineSchema),
  /** Why the last machine would not start, until one starts again. */
  lastError: z.string().nullable(),
});

export const capacityStatsSchema = z.object({
  running: z.number().int(),
  slots: z.number().int(),
  queued: z.number().int(),
  oldestWaitSeconds: z.number().int().nullable(),
  waitP95Seconds: z.number().int().nullable(),
  /** Target for the p95 wait, from settings. */
  waitTargetSeconds: z.number().int(),
  buildMinutesToday: z.number().int(),
  /** Share of build minutes saved by caches, 0 to 1. */
  cacheSavedRatio: z.number().min(0).max(1).nullable(),
  cacheSavedMinutes: z.number().int().nullable(),
});

export const concurrencyPointSchema = z.object({
  start: isoDateTimeSchema,
  jobs: z.number().int().min(0),
});

export const teamShareSchema = z.object({
  team: teamRefSchema,
  running: z.number().int().min(0),
  /** Guaranteed slots from the team's weight. */
  share: z.number().int().min(0),
  weight: z.number().int().min(1),
  /** Using idle capacity beyond its share; returned at the next dispatch. */
  borrowing: z.boolean(),
  waitP95Seconds: z.number().int().nullable(),
});

export const queueItemSchema = z.object({
  jobId: idSchema,
  glyph: glyphStateSchema,
  /** "route-planner · PR #9921". */
  what: z.string(),
  /** "Logistics core is over its share", "linux-x64-large at its limit". */
  why: z.string(),
  waitingSeconds: z.number().int().min(0),
});

export const capacityQuerySchema = z.object({
  range: z.enum(['now', '7d', '30d']).default('now'),
});

export const capacitySchema = z.object({
  stats: capacityStatsSchema,
  pools: z.array(runnerPoolSchema),
  /** Concurrent jobs per 30 minutes over the range, with the peak. */
  concurrency: z.array(concurrencyPointSchema),
  peak: z.object({ jobs: z.number().int(), at: isoDateTimeSchema }).nullable(),
  teams: z.array(teamShareSchema),
  queue: z.array(queueItemSchema),
});

export const createPoolBodySchema = z
  .object({
    key: slugSchema,
    name: z.string().trim().min(1).max(80),
    hosting: poolHostingSchema,
    location: z.string().max(120).optional(),
    labels: z.array(z.string().max(60)).max(20).default([]),
    minRunners: z.number().int().min(0).default(0),
    maxRunners: z.number().int().min(1).max(10_000),
    warmRunners: z.number().int().min(0).default(0),
    cloudAccount: idSchema.optional(),
    cloudBuild: cloudBuildPoolBodySchema.optional(),
  })
  .refine((body) => body.maxRunners >= body.minRunners, {
    message: 'The most runners must be at least the fewest',
    path: ['maxRunners'],
  })
  .refine((body) => (body.hosting === 'cloud-build') === (body.cloudBuild !== undefined), {
    message: 'A Cloud Build pool needs its project, region, image and service account',
    path: ['cloudBuild'],
  });

export const updatePoolBodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  location: z.string().max(120).optional(),
  labels: z.array(z.string().max(60)).max(20).optional(),
  minRunners: z.number().int().min(0).optional(),
  maxRunners: z.number().int().min(1).max(10_000).optional(),
  warmRunners: z.number().int().min(0).optional(),
  /** Replaces a Cloud Build pool's settings as a whole. */
  cloudBuild: cloudBuildPoolBodySchema.optional(),
});

export const teamShareBodySchema = z.object({ weight: z.number().int().min(1).max(1000) });

export const poolKeyParamsSchema = z.object({ key: slugSchema });
export const poolShareParamsSchema = z.object({ key: slugSchema, teamId: idSchema });

/** Returned once on create and on rotate; only its hash is kept. */
export const poolTokenSchema = z.object({ token: z.string(), rotatedAt: isoDateTimeSchema });

/** POST /pools answers with the pool and, this once, its registration token. */
export const createdPoolSchema = z.object({ pool: runnerPoolSchema, token: poolTokenSchema });

export type PoolHosting = z.infer<typeof poolHostingSchema>;
export type RunnerPool = z.infer<typeof runnerPoolSchema>;
export type CapacityStats = z.infer<typeof capacityStatsSchema>;
export type ConcurrencyPoint = z.infer<typeof concurrencyPointSchema>;
export type TeamShare = z.infer<typeof teamShareSchema>;
export type QueueItem = z.infer<typeof queueItemSchema>;
export type CapacityQuery = z.input<typeof capacityQuerySchema>;
export type Capacity = z.infer<typeof capacitySchema>;
export type CreatePoolBody = z.input<typeof createPoolBodySchema>;
export type UpdatePoolBody = z.infer<typeof updatePoolBodySchema>;
export type TeamShareBody = z.infer<typeof teamShareBodySchema>;
export type PoolToken = z.infer<typeof poolTokenSchema>;
export type CreatedPool = z.infer<typeof createdPoolSchema>;
