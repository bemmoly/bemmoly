import { z } from 'zod';
import { runtimeSchema, slugSchema } from './common.ts';

/*
 * Pipeline definitions (architecture §7). The platform team publishes templates (golden
 * paths) as versioned files; an application extends one in `.bemmoly/application.yaml` and
 * overrides only what the template allows. Resolution (another service) turns template plus
 * overrides into the resolved pipeline below, which is stored on the run so a run always
 * shows exactly what it ran. JSON Schema for editors is generated from these.
 */

/** `${{ inputs.node }}`: a template's or a manual run's input. */
export const INTERPOLATION_PATTERN = /\$\{\{\s*inputs\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
/** `${{ matrix.node }}`: one axis of the matrix cell a job runs. */
export const MATRIX_INTERPOLATION_PATTERN = /\$\{\{\s*matrix\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export const scalarSchema = z.union([z.string(), z.number(), z.boolean()]);

/** "acme/node-service@3" → { ref: "acme/node-service", version: 3 }. */
export const templateRefSchema = z
  .string()
  .trim()
  .regex(
    /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*@[1-9][0-9]*$/,
    'Templates look like "acme/node-service@3"',
  )
  .transform((value) => {
    const [ref = '', version = '0'] = value.split('@');
    return { ref, version: Number(version) };
  });

const envNameSchema = z.string().regex(/^[A-Z_][A-Z0-9_]{0,127}$/, 'Use UPPER_SNAKE names');
const stepKeySchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/);

/**
 * An input a template fills from `with`, and a person can set on "Run pipeline…" (the form
 * draws one field per input; `choice` is a select of its `options`).
 */
export const inputTypeSchema = z.enum(['string', 'number', 'boolean', 'choice']);

export const templateInputSchema = z
  .object({
    type: inputTypeSchema.default('string'),
    default: scalarSchema.optional(),
    description: z.string().max(500).optional(),
    required: z.boolean().default(false),
    options: z.array(z.string().min(1).max(200)).min(1).max(100).optional(),
  })
  .refine((input) => input.type !== 'choice' || Boolean(input.options), {
    message: 'A choice input lists its options',
  });

/**
 * A job per cell of `axes` (every combination), minus cells matching an `exclude`, plus each
 * `include` cell: `{ axes: { node: [22, 24] }, include: [{ node: 25 }] }` runs three jobs.
 */
export const matrixSpecSchema = z
  .object({
    axes: z.record(z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/), z.array(scalarSchema).min(1)),
    include: z.array(z.record(z.string(), scalarSchema)).max(64).default([]),
    exclude: z.array(z.record(z.string(), scalarSchema)).max(64).default([]),
  })
  .refine(
    (matrix) =>
      Object.values(matrix.axes).reduce((cells, values) => cells * values.length, 1) <= 64,
    { message: 'A matrix runs at most 64 jobs' },
  );

/** A cron schedule: five fields, read in the IANA time zone given (UTC when absent). */
export const scheduleSpecSchema = z.object({
  cron: z
    .string()
    .trim()
    .regex(/^(\S+\s+){4}\S+$/, 'Use five cron fields, e.g. "0 3 * * 1-5"'),
  timeZone: z
    .string()
    .default('UTC')
    .refine(isTimeZone, 'Use an IANA time zone such as "Asia/Kolkata"'),
  ref: z.string().min(1).max(200).optional(),
  inputs: z.record(z.string(), scalarSchema).default({}),
});

function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export const buildSpecSchema = z.object({
  dockerfile: z.string().default('Dockerfile'),
  context: z.string().default('.'),
  platforms: z.array(z.string()).default(['linux/amd64']),
  /** The runner pool that builds the image; the organisation's default when absent. */
  pool: slugSchema.optional(),
});

/** A step runs as a container: an image and a command, or an action it `uses`. */
export const pipelineStepSpecSchema = z
  .object({
    name: z.string().min(1).max(120),
    key: stepKeySchema.optional(),
    image: z.string().max(300).optional(),
    run: z.string().max(20_000).optional(),
    uses: z.string().max(300).optional(),
    /** A number of shards, or "auto" to split by past test timings. */
    shards: z.union([z.number().int().min(1).max(64), z.literal('auto')]).optional(),
    /** Set by a template; an application cannot remove or override it. */
    locked: z.boolean().default(false),
    needs: z.array(z.string()).default([]),
    env: z.record(envNameSchema, z.string()).default({}),
    /** Secret names only; values never pass through Pipelines' storage. */
    secrets: z.array(envNameSchema).default([]),
    timeoutMinutes: z
      .number()
      .int()
      .min(1)
      .max(24 * 60)
      .optional(),
    /** A runner pool key, e.g. "linux-x64-large". */
    pool: slugSchema.optional(),
    matrix: matrixSpecSchema.optional(),
    /** JUnit XML the step writes, a path or glob in the workspace; feeds tests and timings. */
    junit: z.string().min(1).max(300).optional(),
    /** Files to keep after the job, paths or globs in the workspace. */
    artifacts: z.array(z.string().min(1).max(300)).max(20).default([]),
  })
  .refine((step) => Boolean(step.run) !== Boolean(step.uses), {
    message: 'A step either runs a command or uses an action',
  });

export const deploySpecSchema = z.object({
  kind: runtimeSchema,
  port: z.union([z.number().int().min(1).max(65535), z.string()]).optional(),
  resources: z
    .object({ cpu: z.union([z.number(), z.string()]), memory: z.string() })
    .partial()
    .optional(),
  /** Runtime variable name → secret reference in the environment's secret store. */
  secrets: z.record(envNameSchema, z.string().min(1)).default({}),
  healthcheck: z
    .object({
      path: z.string().startsWith('/').default('/healthz'),
      timeoutSeconds: z.number().int().min(1).max(300).default(5),
    })
    .optional(),
});

/** A template file, e.g. acme/pipeline-templates/node-service.yaml at tag v3. */
export const pipelineTemplateSchema = z.object({
  inputs: z.record(z.string(), templateInputSchema).default({}),
  /** False for pipelines that need no copy of the repository. */
  checkout: z.boolean().default(true),
  build: buildSpecSchema.optional(),
  test: z.array(pipelineStepSpecSchema).default([]),
  deploy: deploySpecSchema.optional(),
  schedules: z.array(scheduleSpecSchema).max(20).default([]),
});

/** A full pipeline written in place, with no template; its inputs are the run form's. */
export const pipelineSpecSchema = pipelineTemplateSchema;

/** The application side: extend a template, fill its inputs, override what it allows. */
export const pipelineExtendsSchema = z.object({
  extends: templateRefSchema,
  with: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  /** Added after the template's steps; locked template steps always stay. */
  test: z.array(pipelineStepSpecSchema).optional(),
  deploy: deploySpecSchema.partial().optional(),
  /** More inputs for the run form, beside the template's. */
  inputs: z.record(z.string(), templateInputSchema).default({}),
  schedules: z.array(scheduleSpecSchema).max(20).optional(),
});

export const pipelineDefinitionSchema = z.union([pipelineExtendsSchema, pipelineSpecSchema]);

export const resolvedStepSchema = z.object({
  key: stepKeySchema,
  name: z.string(),
  image: z.string().nullable(),
  run: z.string().nullable(),
  uses: z.string().nullable(),
  env: z.record(z.string(), z.string()),
  secrets: z.array(z.string()),
  locked: z.boolean(),
  /** Where the step came from, for "what did this run actually do". */
  origin: z.enum(['template', 'application']),
  junit: z.string().nullable().default(null),
  artifacts: z.array(z.string()).default([]),
});

/** A job node in the resolved DAG; one per shard after expansion. */
export const resolvedJobSchema = z.object({
  key: z.string(),
  name: z.string(),
  kind: z.enum(['detect', 'build', 'test', 'scan', 'publish', 'deploy', 'custom']),
  needs: z.array(z.string()),
  steps: z.array(resolvedStepSchema),
  pool: z.string().nullable(),
  shards: z.union([z.number().int().min(1), z.literal('auto')]).nullable(),
  timeoutMinutes: z.number().int().min(1),
  application: slugSchema.nullable(),
  /** The matrix cell this job runs, e.g. { node: 24 }. */
  matrix: z.record(z.string(), scalarSchema).nullable().default(null),
});

/** What is stored on a run: the pipeline exactly as it ran. */
export const resolvedPipelineSchema = z.object({
  template: z.object({ ref: z.string(), version: z.number().int() }).nullable(),
  inputs: z.record(z.string(), scalarSchema),
  checkout: z.boolean().default(true),
  jobs: z.array(resolvedJobSchema),
  deploy: deploySpecSchema.nullable(),
  schedules: z.array(scheduleSpecSchema).default([]),
});

export type TemplateRef = z.output<typeof templateRefSchema>;
export type TemplateInput = z.infer<typeof templateInputSchema>;
export type Scalar = z.infer<typeof scalarSchema>;
export type MatrixSpec = z.infer<typeof matrixSpecSchema>;
export type ScheduleSpec = z.infer<typeof scheduleSpecSchema>;
export type BuildSpec = z.infer<typeof buildSpecSchema>;
export type PipelineStepSpec = z.infer<typeof pipelineStepSpecSchema>;
export type DeploySpec = z.infer<typeof deploySpecSchema>;
export type PipelineTemplate = z.infer<typeof pipelineTemplateSchema>;
export type PipelineSpec = z.infer<typeof pipelineSpecSchema>;
export type PipelineExtends = z.infer<typeof pipelineExtendsSchema>;
export type PipelineDefinition = z.infer<typeof pipelineDefinitionSchema>;
export type ResolvedStep = z.infer<typeof resolvedStepSchema>;
export type ResolvedJob = z.infer<typeof resolvedJobSchema>;
export type ResolvedPipeline = z.infer<typeof resolvedPipelineSchema>;
