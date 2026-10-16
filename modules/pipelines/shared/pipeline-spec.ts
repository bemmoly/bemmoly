import { z } from 'zod';
import { runtimeSchema, slugSchema } from './common.ts';

/*
 * Pipeline definitions (architecture §7). The platform team publishes templates (golden
 * paths) as versioned files; an application extends one in `.bemmoly/application.yaml` and
 * overrides only what the template allows. Resolution (another service) turns template plus
 * overrides into the resolved pipeline below, which is stored on the run so a run always
 * shows exactly what it ran. JSON Schema for editors is generated from these.
 */

/** `${{ inputs.node }}`: the one interpolation a template may use. */
export const INTERPOLATION_PATTERN = /\$\{\{\s*inputs\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

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

export const templateInputSchema = z.object({
  type: z.enum(['string', 'number', 'boolean']).default('string'),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  description: z.string().max(500).optional(),
  required: z.boolean().default(false),
});

export const buildSpecSchema = z.object({
  dockerfile: z.string().default('Dockerfile'),
  context: z.string().default('.'),
  platforms: z.array(z.string()).default(['linux/amd64']),
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
  build: buildSpecSchema.optional(),
  test: z.array(pipelineStepSpecSchema).default([]),
  deploy: deploySpecSchema.optional(),
});

/** A full pipeline written in place, with no template. */
export const pipelineSpecSchema = pipelineTemplateSchema.omit({ inputs: true });

/** The application side: extend a template, fill its inputs, override what it allows. */
export const pipelineExtendsSchema = z.object({
  extends: templateRefSchema,
  with: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  /** Added after the template's steps; locked template steps always stay. */
  test: z.array(pipelineStepSpecSchema).optional(),
  deploy: deploySpecSchema.partial().optional(),
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
});

/** What is stored on a run: the pipeline exactly as it ran. */
export const resolvedPipelineSchema = z.object({
  template: z.object({ ref: z.string(), version: z.number().int() }).nullable(),
  inputs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  jobs: z.array(resolvedJobSchema),
  deploy: deploySpecSchema.nullable(),
});

export type TemplateRef = z.output<typeof templateRefSchema>;
export type TemplateInput = z.infer<typeof templateInputSchema>;
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
