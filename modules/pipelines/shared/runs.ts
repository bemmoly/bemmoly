import { z } from 'zod';
import { applicationRefSchema, repositoryRefSchema } from './catalog.ts';
import {
  glyphStateSchema,
  idSchema,
  isoDateTimeSchema,
  jobStateSchema,
  keysetPageSchema,
  keysetQuerySchema,
  personRefSchema,
  priorityClassSchema,
  runStateSchema,
  scopePathSchema,
  slugSchema,
  stepStateSchema,
  teamRefSchema,
} from './common.ts';

/*
 * Runs, jobs and steps: GET /api/v1/pipelines/runs, /runs/:id, /runs/:id/graph,
 * POST /runs (manual run), POST /runs/:id/rerun, POST /runs/:id/cancel. A run is one commit's
 * (or one request's) pipeline; jobs are its nodes and the dispatcher's queue; steps are the
 * containers a job runs.
 */

export const runTriggerSchema = z.enum([
  'push',
  'pull_request',
  'merge_group',
  'schedule',
  'manual',
  'external',
  'rerun',
]);
export const executorSchema = z.enum(['runners', 'external']);
export const jobKindSchema = z.enum([
  'detect',
  'build',
  'test',
  'scan',
  'publish',
  'deploy',
  'custom',
]);

/** Why a job is not running yet, said on screen: "3rd in Payments' queue, about 40 s". */
export const waitReasonSchema = z.object({
  kind: z.enum([
    'runner',
    'fair_share',
    'concurrency',
    'window',
    'train',
    'approval',
    'dependency',
  ]),
  text: z.string(),
  /** Place in the queue it waits in, 1-based. */
  position: z.number().int().min(1).optional(),
  etaSeconds: z.number().int().min(0).optional(),
});

export const poolRefSchema = z.object({ id: idSchema, key: slugSchema, name: z.string() });

export const stepSchema = z.object({
  id: idSchema,
  position: z.number().int().min(0),
  name: z.string(),
  image: z.string().nullable(),
  run: z.string().nullable(),
  uses: z.string().nullable(),
  /** A template step the application cannot remove. */
  locked: z.boolean(),
  state: stepStateSchema,
  exitCode: z.number().int().nullable(),
  /** Where its output starts in the job's log, for "open the step". */
  firstLine: z.number().int().nullable(),
  lineCount: z.number().int().nullable(),
  startedAt: isoDateTimeSchema.nullable(),
  finishedAt: isoDateTimeSchema.nullable(),
});

export const jobSchema = z.object({
  id: idSchema,
  runId: idSchema,
  application: applicationRefSchema.nullable(),
  key: z.string(),
  name: z.string(),
  kind: jobKindSchema,
  needs: z.array(z.string()),
  state: jobStateSchema,
  pool: poolRefSchema.nullable(),
  shardIndex: z.number().int().nullable(),
  shardTotal: z.number().int().nullable(),
  attempt: z.number().int().min(1),
  maxAttempts: z.number().int().min(1),
  timeoutMinutes: z.number().int(),
  failureSummary: z.string().nullable(),
  /** Groups identical failures across runs (tests.ts, GET /failures). */
  failureFingerprint: z.string().nullable(),
  /** The matrix cell this job runs, e.g. { node: 24 }. */
  matrix: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).nullable(),
  waitReason: waitReasonSchema.nullable(),
  readyAt: isoDateTimeSchema.nullable(),
  startedAt: isoDateTimeSchema.nullable(),
  finishedAt: isoDateTimeSchema.nullable(),
  steps: z.array(stepSchema),
});

export const runSummarySchema = z.object({
  id: idSchema,
  /** "Run 8,812". */
  number: z.number().int(),
  trigger: runTriggerSchema,
  ref: z.string(),
  commitSha: z.string(),
  title: z.string(),
  pullRequest: z.number().int().nullable(),
  issueKey: z.string().nullable(),
  author: personRefSchema.nullable(),
  /** The forge login when the author is not a Bemmoly person. */
  authorLogin: z.string().nullable(),
  team: teamRefSchema.nullable(),
  repository: repositoryRefSchema.nullable(),
  applications: z.array(applicationRefSchema),
  state: runStateSchema,
  priorityClass: priorityClassSchema,
  executor: executorSchema,
  /** The full log at the forge, for runs from Bring your CI. */
  externalUrl: z.string().nullable(),
  supersededByRunId: idSchema.nullable(),
  rerunOfRunId: idSchema.nullable(),
  createdAt: isoDateTimeSchema,
  startedAt: isoDateTimeSchema.nullable(),
  finishedAt: isoDateTimeSchema.nullable(),
  durationSeconds: z.number().int().nullable(),
});

/** One failed test, by file and line, as the failing run's summary lists them. */
export const failedTestSchema = z.object({
  file: z.string(),
  line: z.number().int().nullable(),
  name: z.string(),
  message: z.string().nullable(),
  jobId: idSchema,
  /** "Failed 3 of last 50 on main": suggests flaky rather than broken by this change. */
  flakiness: z
    .object({ failedRecent: z.number().int().min(0), ofRecent: z.number().int().min(0) })
    .nullable(),
  /** Quarantined by the owning team: listed, but it does not fail the run. */
  quarantined: z.boolean(),
  fingerprint: z.string().nullable(),
});

export const testSummarySchema = z.object({
  total: z.number().int().min(0),
  passed: z.number().int().min(0),
  failed: z.number().int().min(0),
  skipped: z.number().int().min(0),
  /** Failures of quarantined tests, inside `failed` and listed in `failures`. */
  quarantined: z.number().int().min(0),
  failures: z.array(failedTestSchema),
});

export const runDetailSchema = runSummarySchema.extend({
  jobs: z.array(jobSchema),
  tests: testSummarySchema.nullable(),
  /** The pipeline exactly as it ran: template plus overrides (pipeline-spec.ts). */
  resolvedSpec: z.unknown().nullable(),
});

/** Stages with fan-out and fan-in, as the StageGraph draws them. */
export const runGraphNodeSchema = z.object({
  jobId: idSchema,
  key: z.string(),
  name: z.string(),
  state: glyphStateSchema,
  /** "2m 41s", "2 failed · 2m 55s", "needs every test". */
  detail: z.string(),
  stage: z.number().int().min(0),
});

export const runGraphSchema = z.object({
  runId: idSchema,
  stages: z.array(z.object({ index: z.number().int().min(0), nodes: z.array(runGraphNodeSchema) })),
  edges: z.array(z.object({ from: z.string(), to: z.string() })),
  /** The node the screen opens on: the first failure, else the running one. */
  focus: z.string().nullable(),
});

export const listRunsQuerySchema = keysetQuerySchema.extend({
  scope: scopePathSchema.optional(),
  application: slugSchema.optional(),
  repository: z.string().max(200).optional(),
  state: z
    .union([z.string(), z.array(z.string())])
    .transform((value) => (Array.isArray(value) ? value : value.split(',')).filter(Boolean))
    .pipe(z.array(runStateSchema).max(7))
    .optional(),
  trigger: runTriggerSchema.optional(),
  mine: z.stringbool().optional(),
  branch: z.string().max(200).optional(),
  q: z.string().trim().max(120).optional(),
});

export const runsPageSchema = keysetPageSchema(runSummarySchema);

export const runParamsSchema = z.object({ id: idSchema });

export const createRunBodySchema = z.object({
  application: slugSchema,
  ref: z.string().min(1).max(200).default('main'),
  commitSha: z
    .string()
    .regex(/^[0-9a-f]{7,64}$/)
    .optional(),
  /** Variables for this run only; names follow the environment variable rule. */
  variables: z
    .record(z.string().regex(/^[A-Z_][A-Z0-9_]{0,127}$/), z.string().max(4096))
    .default({}),
  /** Values for the pipeline's inputs, checked against their types (GET …/pipeline). */
  inputs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});

/** Shift+R re-runs only what failed, keeping the passing work. */
export const rerunBodySchema = z.object({ only: z.enum(['failed', 'all']).default('failed') });

export const cancelRunBodySchema = z.object({ reason: z.string().max(500).optional() });

export type RunTrigger = z.infer<typeof runTriggerSchema>;
export type Executor = z.infer<typeof executorSchema>;
export type JobKind = z.infer<typeof jobKindSchema>;
export type WaitReason = z.infer<typeof waitReasonSchema>;
export type PoolRef = z.infer<typeof poolRefSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Job = z.infer<typeof jobSchema>;
export type RunSummary = z.infer<typeof runSummarySchema>;
export type FailedTest = z.infer<typeof failedTestSchema>;
export type TestSummary = z.infer<typeof testSummarySchema>;
export type RunDetail = z.infer<typeof runDetailSchema>;
export type RunGraphNode = z.infer<typeof runGraphNodeSchema>;
export type RunGraph = z.infer<typeof runGraphSchema>;
export type ListRunsQuery = z.infer<typeof listRunsQuerySchema>;
export type RunsPage = z.infer<typeof runsPageSchema>;
export type CreateRunBody = z.input<typeof createRunBodySchema>;
export type RerunBody = z.input<typeof rerunBodySchema>;
export type CancelRunBody = z.infer<typeof cancelRunBodySchema>;
