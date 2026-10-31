import { z } from 'zod';
import { clusterNameSchema } from './clusters.ts';
import { idSchema } from './common.ts';
import { isImageReference } from './image-reference.ts';

/*
 * Runner pools on GKE Autopilot. Pipelines starts one pod per queued job in the pool's own
 * namespace on an Autopilot cluster in the CI project, and the pod ends with its job, so an
 * idle pool has no pods and costs nothing. Each step runs in its own image as a container
 * beside the runner, and image builds run in Kaniko, because Autopilot allows no privileged
 * pods and so no Docker daemon. Fewest runners keeps that much room warm on the nodes.
 */

/** Kaniko builds images without a daemon or privileges; the debug image has a shell. */
export const DEFAULT_BUILDER_IMAGE = 'gcr.io/kaniko-project/executor:v1.23.2-debug';
/** Autopilot's general-purpose pods take between 1 and 6.5 GiB of memory per vCPU. */
export const AUTOPILOT_MEMORY_PER_CPU = { min: 1, max: 6.5 } as const;

const imageSchema = (example: string) =>
  z.string().trim().refine(isImageReference, `Use an image such as ${example}`);

/** How a GKE Autopilot pool starts its pods, as an admin sets it. */
export const autopilotPoolBodySchema = z
  .object({
    /** The cloud account (project) the cluster lives in: the CI project, or an attached one. */
    account: idSchema,
    location: z
      .string()
      .trim()
      .regex(/^[a-z]+(?:-[a-z]+)*\d+$/, 'Use a region such as us-central1 or asia-south1'),
    cluster: z.object({
      name: clusterNameSchema,
      /** Pipelines creates the cluster when it is missing; only on a managed connection. */
      create: z.boolean(),
    }),
    image: imageSchema('us-docker.pkg.dev/acme-ci/bemmoly/runner-gke:1'),
    /** What each pod asks for; Autopilot bills by what pods ask for, not what they use. */
    cpu: z
      .number()
      .min(0.5, 'Give each runner at least half a vCPU')
      .max(28, 'Ask for at most 28 vCPU per runner')
      .multipleOf(0.25, 'Use a quarter vCPU step, such as 1, 1.5 or 2'),
    memoryGb: z
      .number()
      .min(1, 'Give each runner at least 1 GiB of memory')
      .max(80, 'Ask for at most 80 GiB of memory per runner'),
    /** Spot capacity costs less and Google may take it back; a job taken back fails. */
    spot: z.boolean().default(false),
    /** The Google service account pods act as, through Workload Identity. */
    serviceAccount: z.email(
      'Use the build service account email, such as builder@acme-ci.iam.gserviceaccount.com',
    ),
    builderImage: imageSchema('gcr.io/kaniko-project/executor:v1.23.2-debug').default(
      DEFAULT_BUILDER_IMAGE,
    ),
  })
  .refine(
    (body) =>
      body.memoryGb >= body.cpu * AUTOPILOT_MEMORY_PER_CPU.min &&
      body.memoryGb <= body.cpu * AUTOPILOT_MEMORY_PER_CPU.max,
    {
      message: 'Autopilot needs between 1 and 6.5 GiB of memory for each vCPU',
      path: ['memoryGb'],
    },
  );

export const autopilotStatusSchema = z.enum(['preparing', 'ready', 'failed']);

export const autopilotPoolSchema = z.object({
  account: z.object({ id: idSchema, externalId: z.string(), name: z.string() }),
  location: z.string(),
  cluster: z.object({ name: z.string(), create: z.boolean() }),
  image: z.string(),
  cpu: z.number(),
  memoryGb: z.number(),
  spot: z.boolean(),
  serviceAccount: z.string(),
  builderImage: z.string(),
  /** One namespace per pool. */
  namespace: z.string(),
  /** Whether the cluster, the namespace and the pods' identity are in place. */
  status: autopilotStatusSchema,
  /** GKE's own words while it prepares, or why it could not. */
  statusDetail: z.string().nullable(),
  /** Live counts: pods running a job, pods starting, and warm room ready on the nodes. */
  runners: z.object({
    running: z.number().int().min(0),
    starting: z.number().int().min(0),
    warm: z.number().int().min(0),
  }),
});

export type AutopilotPoolBody = z.input<typeof autopilotPoolBodySchema>;
export type AutopilotPool = z.infer<typeof autopilotPoolSchema>;
export type AutopilotStatus = z.infer<typeof autopilotStatusSchema>;

/** The environment variable that tells a runner it runs in a pod beside its steps' containers. */
export const RUNNER_POD_ENV = 'BEMMOLY_RUNNER_POD';

/**
 * How a runner in a pod hands steps to the containers beside it: each container's agent
 * reads scripts from its own folder under `control` and writes output under `logs`. `steps`
 * names the container each step image runs in; `builder` the one image builds run in.
 */
export const runnerPodSchema = z.object({
  control: z.string().min(1),
  logs: z.string().min(1),
  steps: z.record(z.string(), z.string().regex(/^[a-z0-9-]{1,63}$/)),
  builder: z
    .string()
    .regex(/^[a-z0-9-]{1,63}$/)
    .nullable(),
});

export type RunnerPod = z.infer<typeof runnerPodSchema>;

/** The image a step runs in when the pipeline names none. */
export const DEFAULT_STEP_IMAGE = 'alpine:3.20';
/** The step that builds an image, as `uses: bemmoly/build` or pinned as `bemmoly/build@v1`. */
export const BUILD_ACTION = 'bemmoly/build';

export const isBuildAction = (uses: string): boolean =>
  uses === BUILD_ACTION || uses.startsWith(`${BUILD_ACTION}@`);

/** The images a job's run steps use, in order of first use, and whether it builds an image. */
export function podImagesOf(steps: ReadonlyArray<{ image: string | null; uses: string | null }>): {
  images: string[];
  builds: boolean;
} {
  const images = new Set<string>();
  let builds = false;
  for (const step of steps) {
    if (step.uses) builds ||= isBuildAction(step.uses);
    else images.add(step.image ?? DEFAULT_STEP_IMAGE);
  }
  return { images: [...images], builds };
}
