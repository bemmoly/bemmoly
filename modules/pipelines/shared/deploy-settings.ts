import { z } from 'zod';
import { deployRuntimeSchema, slugSchema } from './common.ts';
import { environmentRefSchema } from './environments.ts';

/*
 * How an application runs in one environment, apart from where: scaling, resources, its port,
 * its health checks and how secrets reach it. GET /applications/:key/settings answers, per
 * environment, the value each setting has and where it came from; PUT
 * /applications/:key/settings/:environment replaces the settings made in Pipelines there, and
 * DELETE clears them.
 *
 * Which value wins, first to last: a setting made in Pipelines, then the environment's entry
 * under `deploy.environments` in .bemmoly/application.yaml, then the file's `deploy`, then the
 * runtime's default. Cloud Run starts at zero instances. GKE starts at two replicas in a
 * prod-class environment, with a disruption budget that lets one go at a time, and one
 * elsewhere.
 */

export const secretsAsSchema = z.enum(['env', 'files']);

const cpuSchema = z.union([
  z.number().positive().max(64),
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?m?$/, 'Write CPU as 1, 0.5 or 500m'),
]);
const memorySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?(Ki|Mi|Gi|Ti|K|M|G|T)?$/, 'Write memory as 512Mi or 2Gi');
const pathSchema = z.string().trim().startsWith('/', 'A path starts with /').max(300);

/**
 * One layer of settings: every field optional and none defaulted, so a layer says only what
 * it sets. Pipelines stores one per application and environment; the file gives two more.
 */
export const deploySettingsSchema = z.object({
  scaling: z
    .object({
      /** Instances on Cloud Run, replicas on GKE. */
      min: z.number().int().min(0).max(1000),
      max: z.number().int().min(1).max(1000),
      /** Cloud Run only: requests one instance takes at once. */
      concurrency: z.number().int().min(1).max(1000),
      /** GKE only: the CPU use, in percent of requests, the autoscaler aims for. */
      cpuTarget: z.number().int().min(1).max(100),
    })
    .partial()
    .optional(),
  resources: z.object({ cpu: cpuSchema, memory: memorySchema }).partial().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  healthcheck: z
    .object({
      /** Liveness: a failing answer restarts the instance or pod. */
      path: pathSchema,
      /** Readiness: no traffic until it answers. The liveness path when absent. */
      ready: pathSchema,
    })
    .partial()
    .optional(),
  secretsAs: secretsAsSchema.optional(),
});

/** Every setting by its dotted name, in the order screens list them. */
export const DEPLOY_SETTING_FIELDS = [
  'scaling.min',
  'scaling.max',
  'scaling.concurrency',
  'scaling.cpuTarget',
  'resources.cpu',
  'resources.memory',
  'port',
  'healthcheck.path',
  'healthcheck.ready',
  'secretsAs',
] as const;

export const deploySettingFieldSchema = z.enum(DEPLOY_SETTING_FIELDS);

/** Where a value came from: Pipelines, the file's environment entry, the file, the runtime. */
export const deploySettingSourceSchema = z.enum([
  'pipelines',
  'file-environment',
  'file',
  'default',
]);

export const deploySettingValueSchema = z.union([z.number(), z.string()]).nullable();

export const deploySettingEntrySchema = z.object({
  field: deploySettingFieldSchema,
  /** What the next deploy uses; null when nothing sets it and the runtime has no default. */
  value: deploySettingValueSchema,
  source: deploySettingSourceSchema,
  /** False when this runtime has no such setting, such as concurrency on GKE. */
  applies: z.boolean(),
});

export const applicationDeploySettingsSchema = z.object({
  environment: environmentRefSchema,
  runtime: deployRuntimeSchema,
  /** The settings made in Pipelines here, exactly as stored. */
  settings: deploySettingsSchema,
  effective: z.array(deploySettingEntrySchema),
  /** GKE keeps all but one replica up through upgrades when it runs two or more. */
  disruptionBudget: z.boolean(),
  /** The release whose application.yaml the file values were read from; null before one. */
  release: z.object({ id: z.string(), version: z.string() }).nullable(),
  /** Why the next deploy would refuse these settings, in one sentence; null when fine. */
  problem: z.string().nullable(),
});

export const applicationDeploySettingsResponseSchema = z.object({
  items: z.array(applicationDeploySettingsSchema),
});

export const deploySettingsParamsSchema = z.object({ key: slugSchema, environment: slugSchema });

/** Replaces the Pipelines layer: a field left out follows the file, then the default. */
export const setDeploySettingsBodySchema = deploySettingsSchema;

/** Every applications' runtime in one environment, for "who follows the default". */
export const environmentRuntimeItemSchema = z.object({
  application: z.object({ key: slugSchema, name: z.string() }),
  runtime: deployRuntimeSchema,
  /** "environment" follows the default; the others override it. */
  source: z.enum(['pipelines', 'file', 'environment']),
});

export const environmentRuntimesResponseSchema = z.object({
  items: z.array(environmentRuntimeItemSchema),
});

/** Settings by dotted name, e.g. { "scaling.min": 2 }: how screens and the resolver walk them. */
export type FlatDeploySettings = Partial<Record<DeploySettingField, number | string>>;

export function flattenDeploySettings(settings: DeploySettings): FlatDeploySettings {
  const flat: FlatDeploySettings = {};
  for (const field of DEPLOY_SETTING_FIELDS) {
    const [head = '', tail] = field.split('.');
    const top = (settings as Record<string, unknown>)[head];
    const value = tail ? (top as Record<string, unknown> | undefined)?.[tail] : top;
    if (typeof value === 'number' || typeof value === 'string') flat[field] = value;
  }
  return flat;
}

/** The nested shape back; parse it with deploySettingsSchema to check the values. */
export function nestDeploySettings(flat: FlatDeploySettings): Record<string, unknown> {
  const nested: Record<string, Record<string, unknown> | number | string> = {};
  for (const [field, value] of Object.entries(flat)) {
    if (value === undefined) continue;
    const [head = '', tail] = field.split('.');
    if (!tail) nested[head] = value;
    else nested[head] = { ...((nested[head] as Record<string, unknown>) ?? {}), [tail]: value };
  }
  return nested;
}

export type SecretsAs = z.infer<typeof secretsAsSchema>;
export type DeploySettings = z.infer<typeof deploySettingsSchema>;
export type DeploySettingField = z.infer<typeof deploySettingFieldSchema>;
export type DeploySettingSource = z.infer<typeof deploySettingSourceSchema>;
export type DeploySettingValue = z.infer<typeof deploySettingValueSchema>;
export type DeploySettingEntry = z.infer<typeof deploySettingEntrySchema>;
export type ApplicationDeploySettings = z.infer<typeof applicationDeploySettingsSchema>;
export type ApplicationDeploySettingsResponse = z.infer<
  typeof applicationDeploySettingsResponseSchema
>;
export type SetDeploySettingsBody = z.input<typeof setDeploySettingsBodySchema>;
export type EnvironmentRuntimeItem = z.infer<typeof environmentRuntimeItemSchema>;
export type EnvironmentRuntimesResponse = z.infer<typeof environmentRuntimesResponseSchema>;
