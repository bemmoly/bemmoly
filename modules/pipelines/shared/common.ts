import { keysetPageSchema, keysetQuerySchema } from '@bemmoly/shared';
import { z } from 'zod';

/*
 * The words every Pipelines contract shares: keys, tiers, environment classes, scopes and
 * the run, job and deployment states. One definition each, so the server, the web app and
 * the CLI can never disagree on what a state is called.
 */

/** "checkout-api", "commerce", "prod-asia-south1": lowercase, digits and dashes. */
export const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]{0,62}$/, 'Use lowercase letters, digits and dashes');

export const idSchema = z.uuid();
export const isoDateTimeSchema = z.iso.datetime({ offset: true });

/** Tier 0 (money, sign-in), Tier 1 (customer-facing), Tier 2 (internal). */
export const tierSchema = z.union([z.literal(0), z.literal(1), z.literal(2)], {
  error: 'A tier is 0, 1 or 2',
});
/** A tier in a query string: "0", "1" or "2". */
export const tierQuerySchema = z.coerce.number().int().min(0).max(2).pipe(tierSchema);

export const environmentClassSchema = z.enum(['dev', 'staging', 'prod']);
export const runtimeSchema = z.enum(['container-service', 'kubernetes', 'function', 'static-site']);
export const lifecycleSchema = z.enum(['experimental', 'production', 'deprecated']);
export const healthSchema = z.enum(['healthy', 'degraded', 'failing', 'unknown']);
export const ciModeSchema = z.enum(['external', 'runners', 'template']);
export const promotionModeSchema = z.enum(['continuous', 'approval', 'train', 'coordinated']);
export const providerSchema = z.enum(['gcp', 'aws', 'azure', 'kubernetes', 'local']);

/** Where in the catalog tree something applies: the organisation, a domain, group or app. */
export const scopeKindSchema = z.enum(['organisation', 'domain', 'group', 'application']);
export const scopeRefSchema = z.object({
  kind: scopeKindSchema,
  /** Absent for the organisation. */
  id: idSchema.optional(),
});

/**
 * A scope in a URL: "" or absent for the organisation, "commerce" for a domain,
 * "commerce/checkout" for a group. Applications are addressed by their own key.
 */
export const scopePathSchema = z
  .string()
  .trim()
  .regex(
    /^([a-z0-9][a-z0-9-]{0,62}(\/[a-z0-9][a-z0-9-]{0,62})?)?$/,
    'Scopes look like "commerce/checkout"',
  );

export const priorityClassSchema = z.enum([
  'rollback',
  'deploy',
  'main',
  'pull_request',
  'scheduled',
]);

/** What a RunGlyph draws: the one vocabulary for every run, job, step and station. */
export const glyphStateSchema = z.enum([
  'queued',
  'running',
  'passed',
  'failed',
  'waiting',
  'skipped',
  'rolled_back',
]);

export const runStateSchema = z.enum([
  'queued',
  'running',
  'waiting',
  'passed',
  'failed',
  'cancelled',
  'skipped',
]);
export const jobStateSchema = z.enum([
  'pending',
  'ready',
  'claimed',
  'running',
  'passed',
  'failed',
  'cancelled',
  'skipped',
]);
export const stepStateSchema = z.enum([
  'pending',
  'running',
  'passed',
  'failed',
  'cancelled',
  'skipped',
]);
export const deploymentStateSchema = z.enum([
  'pending',
  'deploying',
  'canary',
  'waiting',
  'succeeded',
  'failed',
  'rolled_back',
  'cancelled',
]);
/** The materialised state of one application in one environment, as the map counts it. */
export const currentStateSchema = z.enum([
  'idle',
  'deploying',
  'canary',
  'waiting',
  'failed',
  'rolled_back',
]);
export const promotionStateSchema = z.enum([
  'requested',
  'gating',
  'awaiting_approval',
  'scheduled',
  'rolling_out',
  'succeeded',
  'rolled_back',
  'cancelled',
  'failed',
]);

/** Someone named on screen: a person, with initials for the avatar when there is no image. */
export const personRefSchema = z.object({
  id: idSchema,
  name: z.string(),
  avatarUrl: z.string().nullable().optional(),
});

export const teamRefSchema = z.object({ id: idSchema, name: z.string() });

export { keysetPageSchema, keysetQuerySchema };

export type Tier = z.infer<typeof tierSchema>;
export type EnvironmentClass = z.infer<typeof environmentClassSchema>;
export type Runtime = z.infer<typeof runtimeSchema>;
export type Lifecycle = z.infer<typeof lifecycleSchema>;
export type Health = z.infer<typeof healthSchema>;
export type CiMode = z.infer<typeof ciModeSchema>;
export type PromotionMode = z.infer<typeof promotionModeSchema>;
export type Provider = z.infer<typeof providerSchema>;
export type ScopeKind = z.infer<typeof scopeKindSchema>;
export type ScopeRef = z.infer<typeof scopeRefSchema>;
export type PriorityClass = z.infer<typeof priorityClassSchema>;
export type GlyphState = z.infer<typeof glyphStateSchema>;
export type RunState = z.infer<typeof runStateSchema>;
export type JobState = z.infer<typeof jobStateSchema>;
export type StepState = z.infer<typeof stepStateSchema>;
export type DeploymentState = z.infer<typeof deploymentStateSchema>;
export type CurrentState = z.infer<typeof currentStateSchema>;
export type PromotionState = z.infer<typeof promotionStateSchema>;
export type PersonRef = z.infer<typeof personRefSchema>;
export type TeamRef = z.infer<typeof teamRefSchema>;

/**
 * Where an application runs in one environment: Cloud Run, a GKE cluster Pipelines runs in
 * Autopilot or Standard mode, or a cluster the company attached. See shared/runtimes.ts.
 */
export const deployRuntimeSchema = z.enum([
  'cloud-run',
  'gke-autopilot',
  'gke-standard',
  'attached-cluster',
]);
export const DEFAULT_DEPLOY_RUNTIME = 'cloud-run' satisfies z.infer<typeof deployRuntimeSchema>;
export type DeployRuntime = z.infer<typeof deployRuntimeSchema>;
