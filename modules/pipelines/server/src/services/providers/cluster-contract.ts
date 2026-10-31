import type { ClusterGateway, ClusterMode, ClusterOrigin } from '../../../../shared/clusters.ts';
import type { DeployRuntime } from '../../../../shared/common.ts';
import type { ConnectionRecord, MetricsPart, TargetsPart } from './contract.ts';

/*
 * The provider model's cluster half (contract.ts): where an application runs when it is not
 * on the provider's default runtime, and the clusters that runtime needs.
 */

/** One cluster as the provider sees it, created by Pipelines or attached as it was. */
export interface ClusterRecord {
  id: string;
  origin: ClusterOrigin;
  mode: ClusterMode;
  projectId: string;
  location: string;
  name: string;
  /** The owners' own Gateway that routes attach to; null uses one Pipelines makes. */
  gateway: ClusterGateway | null;
}

export interface Placement {
  runtime: DeployRuntime;
  cluster: ClusterRecord | null;
  /** The catalog group's key: one namespace per group in each cluster. */
  namespace: string;
}

/** What GKE says a cluster is doing now. */
export interface ClusterState {
  status: 'creating' | 'ready' | 'failed' | 'missing';
  mode: ClusterMode | null;
  releaseChannel: string | null;
  /** GKE's own words when it failed or is missing. */
  message: string | null;
}

/** What checking a cluster found: what to grant or turn on before deploys can work. */
export interface ClusterCheck {
  ok: boolean;
  mode: ClusterMode | null;
  releaseChannel: string | null;
  problems: string[];
}

/**
 * Clusters Pipelines runs and clusters it only deploys into. Creating one starts it and
 * returns; `read` follows it until GKE says it is running. `verify` checks, as the identity
 * deploys act as, that the cluster can take Pipelines' deploys, and never changes it.
 */
export interface ClustersPart {
  create(
    connection: ConnectionRecord,
    input: {
      projectId: string;
      location: string;
      name: string;
      mode: ClusterMode;
      labels: Readonly<Record<string, string>>;
      /** The project's own account config, for who deploys there. */
      account: Readonly<Record<string, unknown>> | null;
    },
  ): Promise<void>;
  read(connection: ConnectionRecord, cluster: ClusterRecord): Promise<ClusterState>;
  verify(
    connection: ConnectionRecord,
    cluster: ClusterRecord,
    account: Readonly<Record<string, unknown>> | null,
  ): Promise<ClusterCheck>;
}

/** The targets and metrics one runtime other than the provider's default deploys through. */
export interface RuntimeParts {
  targets: TargetsPart;
  metrics?: MetricsPart;
}
