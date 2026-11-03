import { z } from 'zod';
import { idSchema, slugSchema } from './common.ts';

/*
 * "Where <version> goes next" on a run: the version the run made, and for each environment on
 * the path whether it runs there, this run is deploying it, or it gets there by promotion
 * (directly, or through a change request where the environment has an approval rule).
 */

export const RUN_NEXT_PATHS = {
  whereNext: (runId: string) => `/api/v1/pipelines/runs/${encodeURIComponent(runId)}/where-next`,
} as const;

export const runNextStateSchema = z.enum([
  /** Running there now. */
  'deployed',
  'deploying',
  'failed',
  /** One of this run's own steps deploys it there, once the steps before it pass. */
  'this_run',
  /** Reached by promoting the version; the environment has no approval rule. */
  'promote',
  /** Reached through a change request: the environment has an approval rule. */
  'change_request',
]);

export const runNextEnvironmentSchema = z.object({
  key: slugSchema,
  name: z.string(),
  state: runNextStateSchema,
  /** The revision it runs as there ("checkout-api-00042-kel"), once deployed. */
  revision: z.string().nullable(),
  /** The change request that carries this version there, if one does. */
  changeRequest: z.object({ number: z.number().int(), status: z.string() }).nullable(),
});

export const runNextSchema = z.object({
  application: slugSchema.nullable(),
  /** Null until the run made a version (it failed, or it is still building). */
  version: z.string().nullable(),
  releaseId: idSchema.nullable(),
  image: z.string().nullable(),
  environments: z.array(runNextEnvironmentSchema),
});

export type RunNextState = z.infer<typeof runNextStateSchema>;
export type RunNextEnvironment = z.infer<typeof runNextEnvironmentSchema>;
export type RunNext = z.infer<typeof runNextSchema>;
