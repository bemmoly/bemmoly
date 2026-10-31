import { z } from 'zod';
import { projectIdSchema } from './cloud-accounts.ts';
import { idSchema, isoDateTimeSchema, slugSchema } from './common.ts';
import { environmentRefSchema } from './environments.ts';

/*
 * Clusters (journeys proposal, "Projects and clusters"): one per environment, made only when
 * an application there chooses GKE. GET /clusters lists them; POST /clusters creates one
 * through a managed connection or attaches one that exists through an attached connection;
 * POST /clusters/:id/check checks it again; DELETE /clusters/:id forgets an attached one.
 * Pipelines runs the clusters it creates and only ever deploys into the ones it attaches.
 */

export const clusterModeSchema = z.enum(['autopilot', 'standard']);
export const clusterOriginSchema = z.enum(['created', 'attached']);
export const clusterStatusSchema = z.enum(['creating', 'ready', 'failed']);

/** GKE's own rule: a lowercase letter first, then letters, digits and dashes, 40 at most. */
export const clusterNameSchema = z
  .string()
  .trim()
  .regex(/^[a-z]([-a-z0-9]{0,38}[a-z0-9])?$/, 'Use lowercase letters, digits and dashes');

/** A region ("us-central1") or a zone ("us-central1-a"). */
export const clusterLocationSchema = z
  .string()
  .trim()
  .regex(/^[a-z]+-[a-z]+[0-9]+(-[a-z])?$/, 'Name a region or zone such as us-central1');

/** A Gateway the cluster's owners run, which routes attach to instead of Pipelines' own. */
export const clusterGatewaySchema = z.object({ namespace: slugSchema, name: slugSchema });

export const clusterRefSchema = z.object({
  id: idSchema,
  name: z.string(),
  mode: clusterModeSchema,
  origin: clusterOriginSchema,
  status: clusterStatusSchema,
});

export const clusterSchema = clusterRefSchema.extend({
  connectionId: idSchema,
  connectionName: z.string(),
  environment: environmentRefSchema,
  projectId: z.string(),
  location: z.string(),
  /** "REGULAR" for the clusters Pipelines runs; whatever the owners chose for attached ones. */
  releaseChannel: z.string().nullable(),
  gateway: clusterGatewaySchema.nullable(),
  /** What the last check found, each a sentence saying what to grant or turn on. */
  problems: z.array(z.string()),
  lastCheckedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export const clustersResponseSchema = z.object({ items: z.array(clusterSchema) });

/** Through a managed connection: GKE creates it in the environment's project and region. */
export const createClusterBodySchema = z.object({
  origin: z.literal('created'),
  environmentId: idSchema,
  mode: clusterModeSchema.default('autopilot'),
  /** "bemmoly-<environment>" when left out. */
  name: clusterNameSchema.optional(),
});

/** Through an attached connection: a cluster that exists, found by project, location and name. */
export const attachClusterBodySchema = z.object({
  origin: z.literal('attached'),
  environmentId: idSchema,
  projectId: projectIdSchema,
  location: clusterLocationSchema,
  name: clusterNameSchema,
  gateway: clusterGatewaySchema.nullable().default(null),
});

export const clusterBodySchema = z.discriminatedUnion('origin', [
  createClusterBodySchema,
  attachClusterBodySchema,
]);

export const clusterParamsSchema = z.object({ id: idSchema });

export type ClusterMode = z.infer<typeof clusterModeSchema>;
export type ClusterOrigin = z.infer<typeof clusterOriginSchema>;
export type ClusterStatus = z.infer<typeof clusterStatusSchema>;
export type ClusterGateway = z.infer<typeof clusterGatewaySchema>;
export type ClusterRef = z.infer<typeof clusterRefSchema>;
export type Cluster = z.infer<typeof clusterSchema>;
export type ClustersResponse = z.infer<typeof clustersResponseSchema>;
export type ClusterBody = z.input<typeof clusterBodySchema>;
