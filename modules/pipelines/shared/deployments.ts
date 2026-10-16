import { z } from 'zod';
import { applicationRefSchema } from './catalog.ts';
import {
  currentStateSchema,
  deploymentStateSchema,
  glyphStateSchema,
  idSchema,
  isoDateTimeSchema,
  keysetPageSchema,
  keysetQuerySchema,
  personRefSchema,
  scopePathSchema,
  slugSchema,
} from './common.ts';
import { environmentRefSchema } from './environments.ts';

/*
 * Deployments (architecture §12, §13): GET /api/v1/pipelines/deployments,
 * /deployments/:id (with its append-only events), POST /deployments/:id/rollback,
 * GET /applications/:key/environments (the environment strip) and
 * GET /deployments/:id/canary (canary against stable). Roll back is one action from anywhere
 * and is recorded as a deployment like any other.
 */

export const deploymentKindSchema = z.enum(['deploy', 'rollback']);

/** Where a deployment is in its plan: deploying, a canary step, the watch, paused for a person. */
export const deploymentPhaseSchema = z.enum(['deploy', 'step', 'watch', 'paused', 'done']);

/** Kayenta-style: marginal pauses and asks a person; two fails in a row roll back. */
export const canaryVerdictSchema = z.enum(['pass', 'marginal', 'fail', 'pending']);

export const deploymentSchema = z.object({
  id: idSchema,
  promotionId: idSchema.nullable(),
  release: z.object({ id: idSchema, version: z.string() }),
  application: applicationRefSchema,
  environment: environmentRefSchema,
  kind: deploymentKindSchema,
  wave: z.number().int().min(1),
  state: deploymentStateSchema,
  trafficPercent: z.number().int().min(0).max(100),
  revision: z.string().nullable(),
  previous: z
    .object({ releaseId: idSchema, version: z.string(), revision: z.string().nullable() })
    .nullable(),
  rollbackOfId: idSchema.nullable(),
  phase: deploymentPhaseSchema,
  /** "Canary step 2 of 3 is marginal: decide to continue or roll back". */
  pauseReason: z.string().nullable(),
  /** Why it ended where it did: the roll back's cause, or the reason a person gave. */
  reason: z.string().nullable(),
  startedBy: personRefSchema.nullable(),
  startedAt: isoDateTimeSchema.nullable(),
  finishedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

/** One state change, never updated: the source of rewind and of the map's history. */
export const deploymentEventSchema = z.object({
  id: idSchema,
  deploymentId: idSchema,
  state: z.string(),
  trafficPercent: z.number().int().min(0).max(100),
  message: z.string().nullable(),
  data: z.record(z.string(), z.unknown()),
  occurredAt: isoDateTimeSchema,
});

export const deploymentDetailSchema = deploymentSchema.extend({
  events: z.array(deploymentEventSchema),
});

export const listDeploymentsQuerySchema = keysetQuerySchema.extend({
  application: slugSchema.optional(),
  environment: slugSchema.optional(),
  state: deploymentStateSchema.optional(),
  kind: deploymentKindSchema.optional(),
});

export const deploymentsPageSchema = keysetPageSchema(deploymentSchema);
export const deploymentParamsSchema = z.object({ id: idSchema });

/** Restores the previous release's revision unless another release is named. */
export const rollbackBodySchema = z.object({
  toRelease: idSchema.optional(),
  reason: z.string().max(500).optional(),
});

/** pipeline_current: the latest state of one application in one environment. */
export const currentSchema = z.object({
  application: applicationRefSchema,
  environment: environmentRefSchema,
  release: z.object({ id: idSchema, version: z.string() }).nullable(),
  state: currentStateSchema,
  /** The release moving in, while a deploy or canary is under way. */
  moving: z.object({ id: idSchema, version: z.string() }).nullable(),
  trafficPercent: z.number().int().min(0).max(100),
  deploymentId: idSchema.nullable(),
  deployedAt: isoDateTimeSchema.nullable(),
});

/**
 * One card of the application's environment strip. The words under the version ("canary 25%
 * over v1.42.3", "next wave, after asia") are built in the web app from these fields.
 */
export const environmentStripItemSchema = z.object({
  environment: environmentRefSchema,
  protected: z.boolean(),
  version: z.string().nullable(),
  commitSha: z.string().nullable(),
  glyph: glyphStateSchema,
  state: currentStateSchema,
  trafficPercent: z.number().int().min(0).max(100),
  movingVersion: z.string().nullable(),
  previousVersion: z.string().nullable(),
  deployedAt: isoDateTimeSchema.nullable(),
  /** Healthy since, for "healthy 31m". */
  healthySince: isoDateTimeSchema.nullable(),
  /** "next wave, after asia": the wave and what it waits for, when one is planned. */
  nextWave: z.object({ wave: z.number().int(), after: z.string() }).nullable(),
});

export const environmentStripSchema = z.object({
  application: applicationRefSchema,
  items: z.array(environmentStripItemSchema),
});

export const metricPointSchema = z.tuple([isoDateTimeSchema, z.number()]);

export const metricCompareSchema = z.object({
  metric: z.enum(['error_rate', 'latency_p95']),
  /** "%" or "ms". */
  unit: z.string(),
  stable: z.object({ value: z.number().nullable(), series: z.array(metricPointSchema) }),
  canary: z.object({ value: z.number().nullable(), series: z.array(metricPointSchema) }),
  verdict: canaryVerdictSchema,
});

export const canarySampleSchema = z.object({
  stepIndex: z.number().int(),
  phase: z.enum(['step', 'watch']),
  trafficPercent: z.number().int(),
  metric: z.enum(['error_rate', 'latency_p95']),
  canary: z.number().nullable(),
  stable: z.number().nullable(),
  requests: z.number().int(),
  verdict: canaryVerdictSchema,
  sampledAt: isoDateTimeSchema,
});

/** Canary against stable over the same window, as the Prod health card draws it. */
export const canaryAnalysisSchema = z.object({
  deploymentId: idSchema,
  environment: environmentRefSchema,
  trafficPercent: z.number().int(),
  metrics: z.array(metricCompareSchema),
  /** "unavailable" when no metrics source is connected; the checks then say "waiting". */
  source: z.enum(['metrics', 'unavailable']),
  failingSamples: z.number().int().min(0),
  verdict: canaryVerdictSchema,
  phase: deploymentPhaseSchema,
  /** Every sample judged so far, oldest first: the evidence a roll back records. */
  samples: z.array(canarySampleSchema),
});

/** A paused canary's decision, by a person: carry on with the plan, or roll back now. */
export const resumeDeploymentBodySchema = z.object({
  decision: z.enum(['continue', 'rollback']),
  reason: z.string().trim().max(500).optional(),
});

/**
 * GET /current?scope=commerce&at=…: pipeline_current for a scope, now or rewound to a
 * moment from the deployment events.
 */
export const currentQuerySchema = z.object({
  scope: scopePathSchema.optional(),
  application: slugSchema.optional(),
  environment: slugSchema.optional(),
  at: isoDateTimeSchema.optional(),
});

export const currentResponseSchema = z.object({
  at: isoDateTimeSchema.nullable(),
  items: z.array(currentSchema),
});

export type DeploymentKind = z.infer<typeof deploymentKindSchema>;
export type DeploymentPhase = z.infer<typeof deploymentPhaseSchema>;
export type CanaryVerdict = z.infer<typeof canaryVerdictSchema>;
export type CanarySample = z.infer<typeof canarySampleSchema>;
export type ResumeDeploymentBody = z.infer<typeof resumeDeploymentBodySchema>;
export type CurrentQuery = z.infer<typeof currentQuerySchema>;
export type CurrentResponse = z.infer<typeof currentResponseSchema>;
export type Deployment = z.infer<typeof deploymentSchema>;
export type DeploymentEvent = z.infer<typeof deploymentEventSchema>;
export type DeploymentDetail = z.infer<typeof deploymentDetailSchema>;
export type ListDeploymentsQuery = z.infer<typeof listDeploymentsQuerySchema>;
export type DeploymentsPage = z.infer<typeof deploymentsPageSchema>;
export type RollbackBody = z.infer<typeof rollbackBodySchema>;
export type Current = z.infer<typeof currentSchema>;
export type EnvironmentStripItem = z.infer<typeof environmentStripItemSchema>;
export type EnvironmentStrip = z.infer<typeof environmentStripSchema>;
export type MetricPoint = z.infer<typeof metricPointSchema>;
export type MetricCompare = z.infer<typeof metricCompareSchema>;
export type CanaryAnalysis = z.infer<typeof canaryAnalysisSchema>;
