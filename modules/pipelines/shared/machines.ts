import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from './common.ts';
import { isImageReference } from './image-reference.ts';

/*
 * Build machines: who starts the runners a pool's jobs run on. A pool of machines you start
 * takes runners a person starts with the pool's token. A Cloud Build pool starts one build
 * per queued job; the build runs the runner image for that one job and exits. Pools that
 * scale a fleet (GKE Autopilot) come later through the same provider part.
 */

/** Cloud Build's machine types; "default" leaves Cloud Build's own choice. */
export const cloudBuildMachineSchema = z.enum([
  'default',
  'e2-medium',
  'e2-highcpu-8',
  'e2-highcpu-32',
  'n1-highcpu-8',
  'n1-highcpu-32',
]);

/** How a Cloud Build pool starts its builds, as an admin sets it. */
export const cloudBuildPoolBodySchema = z.object({
  /** The cloud account (project) builds run in: the CI project, or an attached one. */
  account: idSchema,
  region: z
    .string()
    .trim()
    .regex(/^[a-z]+(?:-[a-z]+)*\d+$/, 'Use a region such as us-central1 or asia-south1'),
  image: z
    .string()
    .trim()
    .refine(isImageReference, 'Use an image such as us-docker.pkg.dev/acme-ci/bemmoly/runner:1'),
  machine: cloudBuildMachineSchema.default('default'),
  /** The service account builds run as; it needs nothing beyond writing logs and pushing. */
  serviceAccount: z.email(
    'Use the build service account email, such as builder@acme-ci.iam.gserviceaccount.com',
  ),
});

export const cloudBuildPoolSchema = z.object({
  account: z.object({ id: idSchema, externalId: z.string(), name: z.string() }),
  region: z.string(),
  image: z.string(),
  machine: cloudBuildMachineSchema,
  serviceAccount: z.string(),
});

export const machineStateSchema = z.enum([
  'starting',
  'running',
  'finished',
  'failed',
  'cancelled',
]);

/** One machine started for one job, as a pool lists it. */
export const poolMachineSchema = z.object({
  id: idSchema,
  jobId: idSchema,
  runId: idSchema,
  /** "checkout-api · Build". */
  what: z.string(),
  state: machineStateSchema,
  /** The cloud's id for it: a Cloud Build build id. */
  ref: z.string().nullable(),
  logUrl: z.string().nullable(),
  startedAt: isoDateTimeSchema,
});

/** Where a job ran when Pipelines started its machine. */
export const jobMachineSchema = z.object({
  state: machineStateSchema,
  ref: z.string().nullable(),
  logUrl: z.string().nullable(),
  error: z.string().nullable(),
});

export type CloudBuildMachine = z.infer<typeof cloudBuildMachineSchema>;
export type CloudBuildPoolBody = z.input<typeof cloudBuildPoolBodySchema>;
export type CloudBuildPool = z.infer<typeof cloudBuildPoolSchema>;
export type MachineState = z.infer<typeof machineStateSchema>;
export type PoolMachine = z.infer<typeof poolMachineSchema>;
export type JobMachine = z.infer<typeof jobMachineSchema>;
