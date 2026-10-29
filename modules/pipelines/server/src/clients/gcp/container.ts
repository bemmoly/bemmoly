import { z } from 'zod';
import { GcpApiError, type GcpHttp } from './http.ts';
import type { PollOptions } from './operations.ts';

/*
 * Google Kubernetes Engine v1: clusters and the operations that create them. A cluster takes
 * minutes to create, so `createCluster` answers with the operation and callers follow it with
 * `getOperation` instead of holding a request open. GKE's operations are its own shape (a
 * status, not a done flag), so they are not Google's generic long-running operations.
 */

const BASE = 'https://container.googleapis.com/v1';

const clusterSchema = z.object({
  name: z.string(),
  location: z.string().optional(),
  /** PROVISIONING, RUNNING, RECONCILING, STOPPING, ERROR or DEGRADED. */
  status: z.string().default('STATUS_UNSPECIFIED'),
  statusMessage: z.string().optional(),
  endpoint: z.string().optional(),
  masterAuth: z.object({ clusterCaCertificate: z.string().optional() }).default({}),
  autopilot: z.object({ enabled: z.boolean().optional() }).default({}),
  releaseChannel: z.object({ channel: z.string().optional() }).default({}),
  workloadIdentityConfig: z.object({ workloadPool: z.string().optional() }).default({}),
  networkConfig: z
    .object({ gatewayApiConfig: z.object({ channel: z.string().optional() }).optional() })
    .default({}),
  /** GKE's Secret Manager add-on: the managed CSI driver that mounts secret versions. */
  secretManagerConfig: z.object({ enabled: z.boolean().optional() }).default({}),
  currentMasterVersion: z.string().optional(),
});

const operationSchema = z.object({
  name: z.string(),
  /** PENDING, RUNNING, DONE or ABORTING. */
  status: z.string(),
  operationType: z.string().optional(),
  statusMessage: z.string().optional(),
  error: z.object({ message: z.string().optional() }).optional(),
  targetLink: z.string().optional(),
});

export type GkeCluster = z.infer<typeof clusterSchema>;
export type GkeOperation = z.infer<typeof operationSchema>;

/** "projects/acme-dev/locations/us-central1/clusters/bemmoly-dev". */
export const gkeClusterName = (projectId: string, location: string, name: string) =>
  `projects/${projectId}/locations/${location}/clusters/${name}`;

export const GATEWAY_CHANNELS = ['CHANNEL_STANDARD', 'CHANNEL_EXPERIMENTAL'];

/** The Gateway API is on when GKE installed its standard or experimental channel. */
export const gatewayApiOn = (cluster: GkeCluster) =>
  GATEWAY_CHANNELS.includes(cluster.networkConfig.gatewayApiConfig?.channel ?? '');

/** The Secret Manager add-on is on: pods can mount secret versions through its CSI driver. */
export const secretManagerOn = (cluster: GkeCluster) =>
  cluster.secretManagerConfig.enabled === true;

export function createContainerClient(http: GcpHttp, poll: PollOptions) {
  const client = {
    getCluster(name: string): Promise<GkeCluster | null> {
      return http.find({ url: `${BASE}/${name}`, schema: clusterSchema });
    },

    /** Starts creating it; answers with the operation, which runs for several minutes. */
    createCluster(parent: string, cluster: Record<string, unknown>): Promise<GkeOperation> {
      return http.send({
        method: 'POST',
        url: `${BASE}/${parent}/clusters`,
        body: { cluster },
        schema: operationSchema,
      });
    },

    getOperation(name: string): Promise<GkeOperation> {
      return http.send({ url: `${BASE}/${name}`, schema: operationSchema });
    },

    /** Waits for a short operation, such as a node pool change, within the poll budget. */
    async waitForOperation(operation: GkeOperation): Promise<GkeOperation> {
      const deadline = Date.now() + poll.timeoutMs;
      let current = operation;
      while (current.status !== 'DONE') {
        if (Date.now() >= deadline) {
          throw new GcpApiError(
            `${BASE}/${current.name}`,
            504,
            `GKE did not finish ${current.name} in ${Math.round(poll.timeoutMs / 1000)} seconds`,
            'DEADLINE_EXCEEDED',
          );
        }
        await poll.sleep(poll.intervalMs);
        current = await client.getOperation(current.name);
      }
      if (current.error?.message) {
        throw new GcpApiError(`${BASE}/${current.name}`, 500, current.error.message, null);
      }
      return current;
    },
  };
  return client;
}

export type ContainerClient = ReturnType<typeof createContainerClient>;
