import { z } from 'zod';
import {
  deployRuntimeSchema,
  lifecycleSchema,
  runtimeSchema,
  slugSchema,
  tierSchema,
} from './common.ts';
import { pipelineDefinitionSchema } from './pipeline-spec.ts';

/*
 * `.bemmoly/application.yaml`: the catalog lives with the code (architecture §9). Read on
 * every push to the default branch; changing ownership is a pull request reviewed like code.
 * The file is parsed from YAML by the caller and validated here.
 *
 *   name: checkout-api
 *   group: checkout
 *   owner: team/payments
 *   tier: 0
 *   labels: [node, pci]
 *   pipeline:
 *     extends: acme/node-service@3
 *     with: { port: 8081 }
 *   runtimes: { dev: gke-autopilot }
 */

export const APPLICATION_FILE_PATH = '.bemmoly/application.yaml';

/** "team/payments": a team from the identity provider, by its slug. */
export const ownerRefSchema = z
  .string()
  .trim()
  .regex(/^team\/[a-z0-9][a-z0-9-]{0,62}$/, 'Owners look like "team/payments"');

export const applicationFileSchema = z.object({
  name: slugSchema,
  /** The group's key; the group names its domain, so `domain` is only a cross-check. */
  group: slugSchema,
  domain: slugSchema.optional(),
  owner: ownerRefSchema.optional(),
  tier: tierSchema.default(2),
  labels: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  lifecycle: lifecycleSchema.default('production'),
  runtime: runtimeSchema.optional(),
  description: z.string().max(2000).optional(),
  /** Application keys this one calls; feeds coordinated releases and "include callers". */
  dependsOn: z.array(slugSchema).max(100).default([]),
  /** Path filters inside a monorepo; a push touching none of them starts nothing here. */
  paths: z.array(z.string().min(1).max(300)).max(100).default([]),
  pipeline: pipelineDefinitionSchema.optional(),
  /**
   * Where it runs, by environment key. A choice made in Pipelines wins over this, and this
   * wins over the environment's default (shared/runtimes.ts).
   */
  runtimes: z.record(slugSchema, deployRuntimeSchema).optional(),
});

export type OwnerRef = z.infer<typeof ownerRefSchema>;
export type ApplicationFile = z.infer<typeof applicationFileSchema>;
export type ApplicationFileInput = z.input<typeof applicationFileSchema>;
