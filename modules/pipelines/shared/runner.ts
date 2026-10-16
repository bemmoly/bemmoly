import { z } from 'zod';
import { idSchema, isoDateTimeSchema, slugSchema } from './common.ts';
import { jobKindSchema } from './runs.ts';
import { resolvedStepSchema } from './pipeline-spec.ts';

/*
 * The runner protocol, version 1, under /api/v1/runner (versioned apart from the product
 * API; the control plane supports the current and previous runner minor versions):
 *   POST /register            pool token → runner id and runner token
 *   POST /heartbeat           every 10 s; three missed beats return the job to ready
 *   POST /claims              long-poll; answers one job with a short-lived job token, or 204
 *   POST /jobs/:id/state      the job's state
 *   POST /jobs/:id/steps/:position/state
 *   POST /jobs/:id/logs       ordered chunks (about 64 KB or 1 s)
 *   POST /jobs/:id/tests      a JUnit summary
 *   POST /jobs/:id/splits     the test files this shard runs, split by past timings
 *   GET  /jobs/:id/secrets    the values of the secrets the job's steps name
 *   PUT  /jobs/:id/artifacts?name=   one file the job keeps (raw body)
 *   POST /jobs/:id/finish
 * Runners poll out; nothing in the execution plane needs an inbound connection.
 *
 * Runners authenticate with their own tokens, never a person's: the runner token in
 * RUNNER_TOKEN_HEADER for register-time calls (heartbeat, claims), the job token in
 * JOB_TOKEN_HEADER for everything under /jobs/:id. `Authorization` stays the API tokens'.
 */

export const RUNNER_PROTOCOL_VERSION = '1';
/** Every runner request names its protocol version in this header. */
export const RUNNER_PROTOCOL_HEADER = 'x-bemmoly-runner-protocol';
export const RUNNER_TOKEN_HEADER = 'x-bemmoly-runner-token';
export const JOB_TOKEN_HEADER = 'x-bemmoly-job-token';
/** How often a runner heartbeats; three missed beats and its job goes back to the queue. */
export const HEARTBEAT_SECONDS = 10;

export const registerRunnerBodySchema = z.object({
  /** The pool's registration token; hashed at rest and rotatable. */
  poolToken: z.string().min(16).max(200),
  name: z.string().min(1).max(120),
  version: z.string().min(1).max(40),
  labels: z.array(z.string().max(60)).max(50).default([]),
});

export const registerRunnerResponseSchema = z.object({
  runnerId: idSchema,
  /** Bearer token for every later call from this runner. */
  runnerToken: z.string(),
  pool: z.object({ id: idSchema, key: slugSchema }),
  heartbeatSeconds: z.number().int().min(1),
});

export const heartbeatBodySchema = z.object({
  state: z.enum(['idle', 'busy', 'draining']),
  jobId: idSchema.nullable().default(null),
});

export const heartbeatResponseSchema = z.object({
  /** True when the job was cancelled or superseded: stop it and finish as cancelled. */
  cancel: z.boolean(),
  drain: z.boolean(),
});

export const claimBodySchema = z.object({
  /** How long the server may hold the request open before answering 204. */
  waitSeconds: z.number().int().min(0).max(60).default(30),
});

export const claimedJobSchema = z.object({
  jobId: idSchema,
  runId: idSchema,
  runNumber: z.number().int(),
  key: z.string(),
  name: z.string(),
  kind: jobKindSchema,
  attempt: z.number().int().min(1),
  /** Scoped to this job; expires when the job's timeout does. */
  jobToken: z.string(),
  expiresAt: isoDateTimeSchema,
  timeoutMinutes: z.number().int().min(1),
  repository: z.object({
    fullName: z.string(),
    cloneUrl: z.string(),
    commitSha: z.string(),
    ref: z.string(),
  }),
  shard: z.object({ index: z.number().int(), total: z.number().int() }).nullable(),
  /** The matrix cell, also in env as BEMMOLY_MATRIX_<AXIS>. */
  matrix: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).nullable(),
  /** False when the pipeline needs no copy of the repository. */
  checkout: z.boolean(),
  steps: z.array(resolvedStepSchema),
  env: z.record(z.string(), z.string()),
  /** Names only; the runner fetches values with the job token, masked in logs. */
  secrets: z.array(z.string()),
  cacheKeys: z.array(
    z.object({ path: z.string(), key: z.string(), restoreKeys: z.array(z.string()) }),
  ),
  /** The issuer the job's OIDC tokens come from, for cloud federation. */
  oidcIssuer: z.string().nullable(),
});

export const claimResponseSchema = z.object({ job: claimedJobSchema });

export const jobStateBodySchema = z.object({
  state: z.enum(['running', 'passed', 'failed', 'cancelled']),
  failureSummary: z.string().max(2000).optional(),
  at: isoDateTimeSchema,
});

export const stepStateBodySchema = z.object({
  state: z.enum(['running', 'passed', 'failed', 'cancelled', 'skipped']),
  exitCode: z.number().int().optional(),
  firstLine: z.number().int().min(1).optional(),
  at: isoDateTimeSchema,
});

/** One ordered chunk; resent after an outage with the same seq, so it is idempotent. */
export const logChunkUploadSchema = z
  .object({
    seq: z.number().int().min(0),
    firstLine: z.number().int().min(1),
    stepPosition: z.number().int().min(0).optional(),
    lines: z.array(z.string().max(64_000)).max(10_000).optional(),
    /** The same lines, gzip compressed and base64 encoded, for large chunks. */
    gzipBase64: z.string().max(2_000_000).optional(),
    lineCount: z.number().int().min(0),
  })
  .refine((chunk) => Boolean(chunk.lines) !== Boolean(chunk.gzipBase64), {
    message: 'Send lines or gzipBase64, not both',
  });

export const testCaseResultSchema = z.object({
  file: z.string(),
  name: z.string(),
  line: z.number().int().nullable().default(null),
  outcome: z.enum(['passed', 'failed', 'skipped']),
  durationMs: z.number().int().min(0),
  message: z.string().max(4000).nullable().default(null),
});

/** A JUnit report, summarised by the runner; feeds test timings and flakiness. */
export const testReportUploadSchema = z.object({
  total: z.number().int().min(0),
  passed: z.number().int().min(0),
  failed: z.number().int().min(0),
  skipped: z.number().int().min(0),
  durationMs: z.number().int().min(0),
  cases: z.array(testCaseResultSchema).max(50_000),
});

export const finishJobBodySchema = z.object({
  state: z.enum(['passed', 'failed', 'cancelled']),
  failureSummary: z.string().max(2000).optional(),
  /** Images the job pushed, platform → digest, when it built one. */
  imageDigests: z.record(z.string(), z.string().regex(/^sha256:[0-9a-f]{64}$/)).optional(),
  at: isoDateTimeSchema,
});

/** The files a shard runs: every shard sends the same list and gets its own part back. */
export const splitsBodySchema = z.object({
  files: z.array(z.string().min(1).max(500)).max(20_000),
});
export const splitsResponseSchema = z.object({
  files: z.array(z.string()),
  /** Expected seconds for this shard, from past timings. */
  expectedSeconds: z.number().int().min(0),
});

/** Values for the secrets the job's steps name; missing ones are absent, never empty. */
export const jobSecretsResponseSchema = z.object({ values: z.record(z.string(), z.string()) });

export const artifactUploadQuerySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Artifact names use letters, digits, dots and dashes'),
});

export const jobArtifactSchema = z.object({
  id: idSchema,
  name: z.string(),
  size: z.number().int().min(0),
  contentType: z.string(),
  createdAt: isoDateTimeSchema,
});

export const runnerJobParamsSchema = z.object({ id: idSchema });
export const runnerStepParamsSchema = z.object({
  id: idSchema,
  position: z.coerce.number().int().min(0),
});

export type RegisterRunnerBody = z.input<typeof registerRunnerBodySchema>;
export type RegisterRunnerResponse = z.infer<typeof registerRunnerResponseSchema>;
export type HeartbeatBody = z.input<typeof heartbeatBodySchema>;
export type HeartbeatResponse = z.infer<typeof heartbeatResponseSchema>;
export type ClaimBody = z.input<typeof claimBodySchema>;
export type ClaimedJob = z.infer<typeof claimedJobSchema>;
export type ClaimResponse = z.infer<typeof claimResponseSchema>;
export type JobStateBody = z.infer<typeof jobStateBodySchema>;
export type StepStateBody = z.infer<typeof stepStateBodySchema>;
export type LogChunkUpload = z.infer<typeof logChunkUploadSchema>;
export type TestCaseResult = z.infer<typeof testCaseResultSchema>;
export type TestReportUpload = z.input<typeof testReportUploadSchema>;
export type FinishJobBody = z.infer<typeof finishJobBodySchema>;
export type SplitsBody = z.infer<typeof splitsBodySchema>;
export type SplitsResponse = z.infer<typeof splitsResponseSchema>;
export type JobSecretsResponse = z.infer<typeof jobSecretsResponseSchema>;
export type JobArtifact = z.infer<typeof jobArtifactSchema>;
