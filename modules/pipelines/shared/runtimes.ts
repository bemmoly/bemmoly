import { z } from 'zod';
import { clusterRefSchema } from './clusters.ts';
import { deployRuntimeSchema, slugSchema } from './common.ts';
import { environmentRefSchema } from './environments.ts';
import { moveRefSchema } from './moves.ts';

/*
 * Where an application runs in one environment (journeys proposal, "Each service picks its
 * runtime"): Cloud Run, GKE Autopilot, GKE Standard or a cluster the company already runs.
 * GET /applications/:key/runtimes says, per environment, what the next deploy uses and why;
 * PUT /applications/:key/runtimes/:environment chooses one, or null to follow the defaults.
 *
 * Which choice wins, first to last: the one made in Pipelines, then `runtimes` in the
 * application's .bemmoly/application.yaml, then the environment's default, which is Cloud
 * Run unless an admin changed it. Pipelines wins so a switch never needs a commit; the file
 * still lets a team that keeps everything in Git say it there. A switch takes effect on the
 * next deploy; a canary already running finishes where it started. Where the environment
 * has a front door for the application, a switch plans a runtime move instead (moves.ts).
 */

/** Where the runtime in force came from. */
export const runtimeSourceSchema = z.enum(['pipelines', 'file', 'environment']);

export const applicationRuntimeSchema = z.object({
  environment: environmentRefSchema,
  /** What the next deploy uses. */
  runtime: deployRuntimeSchema,
  source: runtimeSourceSchema,
  /** Chosen in Pipelines; null follows the file, then the environment. */
  chosen: deployRuntimeSchema.nullable(),
  /** What application.yaml names for this environment; null when it names nothing. */
  file: deployRuntimeSchema.nullable(),
  environmentDefault: deployRuntimeSchema,
  /** The environment's cluster, when it has one. */
  cluster: clusterRefSchema.nullable(),
  /** Why the next deploy would fail, in one sentence saying what to do; null when it can go. */
  problem: z.string().nullable(),
  /**
   * The front door's host here, when there is one: a switch is then a traffic move with no
   * downtime. Without one the switch waits for the next deploy and the address changes.
   */
  frontDoor: z.object({ host: z.string(), url: z.string().nullable() }).nullable().default(null),
  /** The move planned or under way here, if any. */
  move: moveRefSchema.nullable().default(null),
});

export const applicationRuntimesResponseSchema = z.object({
  items: z.array(applicationRuntimeSchema),
});

export const setApplicationRuntimeBodySchema = z.object({
  runtime: deployRuntimeSchema.nullable(),
});

export const applicationRuntimeParamsSchema = z.object({
  key: slugSchema,
  environment: slugSchema,
});

export type RuntimeSource = z.infer<typeof runtimeSourceSchema>;
export type ApplicationRuntime = z.infer<typeof applicationRuntimeSchema>;
export type ApplicationRuntimesResponse = z.infer<typeof applicationRuntimesResponseSchema>;
export type SetApplicationRuntimeBody = z.infer<typeof setApplicationRuntimeBodySchema>;
