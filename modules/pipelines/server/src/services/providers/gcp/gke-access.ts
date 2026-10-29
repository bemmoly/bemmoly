import { ValidationError } from '@bemmoly/shared';
import { gkeClusterName, type GcpClients, type GkeCluster } from '../../../clients/gcp/index.ts';
import {
  clusterTransport,
  createKubernetesClient,
  pemFromBase64,
  type KubernetesClient,
  type KubernetesTransport,
} from '../../../clients/kubernetes/index.ts';
import type { ClusterRecord, ConnectionRecord, DeployTarget } from '../contract.ts';
import { accountConfigOf, type GcpContexts } from './context.ts';

/*
 * Reaching a GKE cluster's own API: its endpoint and certificate authority come from GKE, the
 * token is the Google identity deploys act as there (the environment's deployer when the
 * cluster lives in the environment's project, otherwise the connection's own identity, so an
 * attached cluster sees exactly the identity it granted). Endpoints are cached briefly so a
 * canary's every sample does not ask GKE again.
 */

const ENDPOINT_TTL_MS = 10 * 60_000;

export interface GkeAccessOptions {
  kubernetesTransport?: (caPem: string) => KubernetesTransport;
  now?: () => number;
}

export interface GkeHandle {
  google: GcpClients;
  kube: KubernetesClient;
  cluster: GkeCluster;
}

export const clusterPath = (cluster: Pick<ClusterRecord, 'projectId' | 'location' | 'name'>) =>
  gkeClusterName(cluster.projectId, cluster.location, cluster.name);

/** Who deploys into a cluster: the account's deployer when it is that account's project. */
export function identityFor(
  contexts: GcpContexts,
  connection: ConnectionRecord,
  cluster: Pick<ClusterRecord, 'projectId'>,
  account: Readonly<Record<string, unknown>> | null,
): GcpClients {
  return contexts(connection).deployer(cluster.projectId, accountConfigOf(account ?? {}));
}

export function createGkeAccess(contexts: GcpContexts, options: GkeAccessOptions = {}) {
  const transportFor = options.kubernetesTransport ?? clusterTransport;
  const now = options.now ?? Date.now;
  const cache = new Map<string, { at: number; cluster: GkeCluster; kube: KubernetesClient }>();

  async function open(
    connection: ConnectionRecord,
    record: ClusterRecord,
    account: Readonly<Record<string, unknown>> | null,
  ): Promise<GkeHandle> {
    const google = identityFor(contexts, connection, record, account);
    const name = clusterPath(record);
    const key = `${connection.id}:${name}`;
    const cached = cache.get(key);
    if (cached && now() - cached.at < ENDPOINT_TTL_MS) {
      return { google, kube: cached.kube, cluster: cached.cluster };
    }
    const cluster = await google.container.getCluster(name);
    if (!cluster) {
      throw new ValidationError(
        `Cluster ${record.name} was not found in ${record.projectId}, ${record.location}. Check it in Platform › Clusters`,
      );
    }
    const ca = cluster.masterAuth.clusterCaCertificate;
    if (!cluster.endpoint || !ca) {
      throw new ValidationError(`Cluster ${record.name} has no endpoint yet; wait until it runs`);
    }
    const kube = createKubernetesClient({
      endpoint: cluster.endpoint,
      tokens: google.tokens,
      transport: transportFor(pemFromBase64(ca)),
    });
    cache.set(key, { at: now(), cluster, kube });
    return { google, kube, cluster };
  }

  return {
    open,
    /** The cluster a target deploys into, opened as the identity deploys act as there. */
    async target(
      target: DeployTarget,
    ): Promise<GkeHandle & { record: ClusterRecord; namespace: string }> {
      const record = target.placement?.cluster;
      if (!record) {
        throw new ValidationError(
          `${target.environment.key} has no cluster for ${target.application.key}. Create or attach one in Platform › Clusters`,
        );
      }
      const sameProject = target.account?.externalId === record.projectId;
      const handle = await open(
        target.connection,
        record,
        sameProject ? (target.account?.config ?? null) : null,
      );
      return { ...handle, record, namespace: target.placement?.namespace ?? 'default' };
    },
  };
}

export type GkeAccess = ReturnType<typeof createGkeAccess>;
