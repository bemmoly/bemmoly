import { z } from 'zod';
import { askWhoSchema } from './access.ts';
import { applicationRefSchema } from './catalog.ts';
import {
  environmentClassSchema,
  idSchema,
  isoDateTimeSchema,
  keysetPageSchema,
  keysetQuerySchema,
  personRefSchema,
  promotionModeSchema,
  promotionStateSchema,
  scopePathSchema,
  slugSchema,
} from './common.ts';
import { environmentRefSchema } from './environments.ts';

/*
 * Promotion (architecture §11): GET /api/v1/pipelines/promotions, /promotions/:id,
 * POST /promotions (request), POST /promotions/:id/approvals (approve or reject),
 * POST /promotions/:id/cancel, GET /promotions/preview (the same, before it is requested).
 * A promotion moves one release to one environment: gates, then
 * approvals, then a window or a train, then waves of canary steps. The person requesting it
 * sees exactly what the approver will see.
 */

export const gateSchema = z.enum([
  'tests',
  'security_scan',
  'staging_healthy',
  'window',
  'freeze',
  'approvals',
  'error_budget',
  'canary',
  'dependencies',
  'migration_reviewed',
  'custom',
]);

/** A fact that is unavailable is "pending" with its reason, never "pass". */
export const gateStateSchema = z.enum(['pass', 'fail', 'pending']);

export const gateResultSchema = z.object({
  gate: gateSchema,
  /** "Tests and security", "Healthy in Staging". */
  label: z.string(),
  state: gateStateSchema,
  /** "31 minutes, needs 30", "open until 16:00". */
  reason: z.string(),
  evidence: z.record(z.string(), z.unknown()),
  recheckAt: isoDateTimeSchema.nullable(),
  evaluatedAt: isoDateTimeSchema,
});

export const canaryStepSchema = z.object({
  trafficPercent: z.number().int().min(1).max(100),
  holdMinutes: z.number().int().min(0),
});

/** One wave of the rollout: a set of environments that go together. */
export const rolloutWaveSchema = z.object({
  wave: z.number().int().min(1),
  environments: z.array(environmentRefSchema).min(1),
  /** 5%, then 25%, then 100%, each judged on metrics; empty means straight to 100%. */
  steps: z.array(canaryStepSchema),
  /** "30 minutes after wave 1 reaches 100%". */
  startsAfter: z
    .object({ wave: z.number().int().min(1), bakeMinutes: z.number().int() })
    .nullable(),
  checks: z.array(z.enum(['error_rate', 'latency_p95', 'custom'])),
});

export const rolloutPlanSchema = z.object({
  waves: z.array(rolloutWaveSchema),
  /** Roll back by itself if a check fails twice. */
  autoRollback: z.boolean(),
});

export const approvalDecisionSchema = z.enum(['approved', 'rejected']);

export const approvalSchema = z.object({
  id: idSchema,
  user: personRefSchema,
  /** Which requirement it counts toward: "owning_team", "oncall:sre". */
  requirement: z.string(),
  decision: approvalDecisionSchema,
  /** Approvals bind to the release digest; a different digest needs new ones. */
  releaseDigest: z.string(),
  comment: z.string().nullable(),
  expiresAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

/** "1 more from Payments, not the author": one approval rule and how far it has got. */
export const approvalRequirementSchema = z.object({
  requirement: z.string(),
  label: z.string(),
  needed: z.number().int().min(1),
  have: z.number().int().min(0),
  candidates: z.array(personRefSchema),
  excludesAuthors: z.boolean(),
  /** Whether the person asking may approve toward this one. */
  canApprove: z.boolean(),
});

/** The release a promotion moves; approvals bind to its digest. */
export const promotionReleaseSchema = z.object({
  id: idSchema,
  version: z.string(),
  commitSha: z.string(),
  /** What an approver sends back in `releaseDigest`. */
  digest: z.string(),
});

/** What runs in the target now, for "v1.42.3 to v1.43.0"; null on a first deploy there. */
export const promotionPreviousSchema = z.object({ id: idSchema, version: z.string() }).nullable();

export const promotionSchema = z.object({
  id: idSchema,
  release: promotionReleaseSchema,
  previous: promotionPreviousSchema,
  application: applicationRefSchema,
  environment: environmentRefSchema,
  mode: promotionModeSchema,
  state: promotionStateSchema,
  plan: rolloutPlanSchema,
  gates: z.array(gateResultSchema),
  approvals: z.array(approvalSchema),
  requirements: z.array(approvalRequirementSchema),
  departure: z
    .object({ id: idSchema, trainName: z.string(), departsAt: isoDateTimeSchema })
    .nullable(),
  coordinationId: idSchema.nullable(),
  /** "Tier 0 · Prod, from Commerce": the policies that applied, as sentences. */
  policies: z.array(z.object({ id: idSchema, name: z.string(), version: z.number().int() })),
  requestedBy: personRefSchema.nullable(),
  expiresAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  finishedAt: isoDateTimeSchema.nullable(),
});

/**
 * GET /promotions/preview?release=…&to=prod: the promotion as it would be if requested now,
 * with the same gates, approvals and plan the approver will see. Nothing is written, so the
 * Promote screen shows the decision before the request exists.
 */
export const promotionPreviewQuerySchema = z.object({
  release: idSchema,
  to: z.union([slugSchema, environmentClassSchema]),
});

/** A train departure this promotion may join instead of going as soon as it is approved. */
export const joinableDepartureSchema = z.object({
  id: idSchema,
  trainName: z.string(),
  departsAt: isoDateTimeSchema,
  /** "14 applications, one approval for all". */
  applicationCount: z.number().int().min(0),
});

export const promotionPreviewSchema = z.object({
  release: promotionReleaseSchema,
  previous: promotionPreviousSchema,
  application: applicationRefSchema,
  /** Every environment `to` named, in rollout order. */
  environments: z.array(environmentRefSchema).min(1),
  gates: z.array(gateResultSchema),
  requirements: z.array(approvalRequirementSchema),
  plan: rolloutPlanSchema,
  policies: z.array(z.object({ id: idSchema, name: z.string(), version: z.number().int() })),
  departures: z.array(joinableDepartureSchema),
  /** Whether the person asking may request it; when not, why and whom to ask. */
  request: z.object({
    allowed: z.boolean(),
    sentence: z.string().nullable(),
    askWho: askWhoSchema.nullable(),
  }),
  /** A promotion of this release to this target that is still open; the screen opens it. */
  existingId: idSchema.nullable(),
  /** When a request made now would expire unapproved. */
  expiresAt: isoDateTimeSchema.nullable(),
});

export const listPromotionsQuerySchema = keysetQuerySchema.extend({
  scope: scopePathSchema.optional(),
  application: slugSchema.optional(),
  state: promotionStateSchema.optional(),
  /** Only the ones the person can approve now: For you's "Waiting for you". */
  awaitingMe: z.stringbool().optional(),
});

export const promotionsPageSchema = keysetPageSchema(promotionSchema);
export const promotionParamsSchema = z.object({ id: idSchema });

export const createPromotionBodySchema = z.object({
  release: idSchema,
  /** An environment key, or a class: "prod" means every Prod environment on the path. */
  to: z.union([slugSchema, environmentClassSchema]),
  mode: promotionModeSchema.default('approval'),
  /** Join this train departure instead of going as soon as approved. */
  departure: idSchema.optional(),
  /** A plan narrower than the default may be asked for; never a less careful one. */
  plan: rolloutPlanSchema.partial().optional(),
  note: z.string().max(2000).optional(),
});

/** Approvals by people only, never tokens or AI; the server re-checks policy and identity. */
export const approvalBodySchema = z.object({
  decision: approvalDecisionSchema,
  /** The digest the approver saw, so a changed release cannot ride on this approval. */
  releaseDigest: z.string().min(1),
  comment: z.string().max(2000).optional(),
});

export const cancelPromotionBodySchema = z.object({ reason: z.string().max(500).optional() });

export type Gate = z.infer<typeof gateSchema>;
export type GateState = z.infer<typeof gateStateSchema>;
export type GateResult = z.infer<typeof gateResultSchema>;
export type CanaryStep = z.infer<typeof canaryStepSchema>;
export type RolloutWave = z.infer<typeof rolloutWaveSchema>;
export type RolloutPlan = z.infer<typeof rolloutPlanSchema>;
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;
export type Approval = z.infer<typeof approvalSchema>;
export type ApprovalRequirement = z.infer<typeof approvalRequirementSchema>;
export type PromotionRelease = z.infer<typeof promotionReleaseSchema>;
export type Promotion = z.infer<typeof promotionSchema>;
export type PromotionPreviewQuery = z.infer<typeof promotionPreviewQuerySchema>;
export type JoinableDeparture = z.infer<typeof joinableDepartureSchema>;
export type PromotionPreview = z.infer<typeof promotionPreviewSchema>;
export type ListPromotionsQuery = z.infer<typeof listPromotionsQuerySchema>;
export type PromotionsPage = z.infer<typeof promotionsPageSchema>;
export type CreatePromotionBody = z.input<typeof createPromotionBodySchema>;
export type ApprovalBody = z.infer<typeof approvalBodySchema>;
export type CancelPromotionBody = z.infer<typeof cancelPromotionBodySchema>;
