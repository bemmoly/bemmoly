import { ValidationError } from '@bemmoly/shared';
import { gkeClusterName, type GcpClients, type GkeCluster } from '../../../clients/gcp/index.ts';
import {
  clusterTransport,
  createKubernetesClient,
  pemFromBase64,
  type KubernetesClient,
  type KubernetesTransport,
} from '../../../clients/kubernetes/index.ts';
import type { ConnectionRecord } from '../contract.ts';
import type { AccountRef } from '../runners-contract.ts';
import { accountConfigOf, type GcpContexts } from './context.ts';

/*
 * Reaching the cluster a runner pool runs on. Runner pools live in a CI project, not an
 * environment's, so Pipelines acts there as it does for Cloud Build: as the control identity
 * on a managed connection, and as the project's deployer (or the connection's identity) on an
 * attached one. The cluster's endpoint is cached briefly so each sweep does not ask GKE again.
 */

const ENDPOINT_TTL_MS = 10 * 60_000;

/** "projects/p/locations/l/clusters/c/namespaces/ns", optionally ".../jobs/j". */
const REF =
  /^(projects\/[^/]+\/locations\/[^/]+\/clusters\/[^/]+)\/namespaces\/([^/]+)(?:\/jobs\/([^/]+))?$/;

export interface PodRef {
  cluster: string;
  namespace: string;
  job: string | null;
}

export function parsePodRef(ref: string): PodRef | null {
  const match = REF.exec(ref);
  if (!match?.[1] || !match[2]) return null;
  return { cluster: match[1], namespace: match[2], job: match[3] ?? null };
}

export const poolRefOf = (cluster: string, namespace: string) =>
  `${cluster}/namespaces/${namespace}`;

export const clusterPathOf = (project: string, location: string, name: string) =>
  gkeClusterName(project, location, name);

export interface PodAccessOptions {
  kubernetesTransport?: (caPem: string) => KubernetesTransport;
  now?: () => number;
}

export function createPodAccess(contexts: GcpContexts, options: PodAccessOptions = {}) {
  const transportFor = options.kubernetesTransport ?? clusterTransport;
  const now = options.now ?? Date.now;
  const cache = new Map<string, { at: number; cluster: GkeCluster; kube: KubernetesClient }>();

  function google(connection: ConnectionRecord, account: AccountRef): GcpClients {
    const context = contexts(connection);
    if (context.config.mode !== 'attached') return context.control;
    return context.deployer(account.externalId, accountConfigOf(account.config));
  }

  return {
    google,

    /** The cluster's API, as Pipelines acts in the project; `known` skips asking GKE. */
    async open(
      connection: ConnectionRecord,
      account: AccountRef,
      clusterPath: string,
      known?: GkeCluster,
    ): Promise<{ kube: KubernetesClient; cluster: GkeCluster }> {
      const key = `${connection.id}:${clusterPath}`;
      const cached = cache.get(key);
      if (!known && cached && now() - cached.at < ENDPOINT_TTL_MS) return cached;
      const clients = google(connection, account);
      const cluster = known ?? (await clients.container.getCluster(clusterPath));
      const ca = cluster?.masterAuth.clusterCaCertificate;
      if (!cluster?.endpoint || !ca) {
        throw new ValidationError(
          `${clusterPath} is not running yet, so Pipelines cannot start runner pods there`,
        );
      }
      const kube = createKubernetesClient({
        endpoint: cluster.endpoint,
        tokens: clients.tokens,
        transport: transportFor(pemFromBase64(ca)),
      });
      const entry = { at: now(), cluster, kube };
      cache.set(key, entry);
      return entry;
    },
  };
}

export type PodAccess = ReturnType<typeof createPodAccess>;
