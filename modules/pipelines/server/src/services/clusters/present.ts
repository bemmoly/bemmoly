import type { Cluster } from '../../../../shared/clusters.ts';
import type { Layout } from '../../../../shared/clouds.ts';
import type { EnvironmentClass, Provider } from '../../../../shared/common.ts';
import type { ClusterRow } from '../../models/clusters.ts';
import { iso, isoOrNull } from '../../utils/time.ts';
import type { ClusterRecord, ConnectionRecord } from '../providers/contract.ts';

/* A cluster row as the API shows it, and as the provider is handed it. */

export function toCluster(row: ClusterRow): Cluster {
  return {
    id: row.id,
    name: row.name,
    mode: row.mode === 'standard' ? 'standard' : 'autopilot',
    origin: row.origin === 'attached' ? 'attached' : 'created',
    status: row.status as Cluster['status'],
    connectionId: row.connection_id,
    connectionName: row.connection_name,
    environment: {
      id: row.environment_id,
      key: row.environment_key,
      name: row.environment_name,
      class: row.environment_class as EnvironmentClass,
    },
    projectId: row.project_id,
    location: row.location,
    releaseChannel: row.release_channel,
    gateway: row.gateway,
    problems: row.problems,
    lastCheckedAt: isoOrNull(row.last_checked_at),
    createdAt: iso(row.created_at),
  };
}

export function clusterRecordOf(row: ClusterRow): ClusterRecord {
  const cluster = toCluster(row);
  return {
    id: cluster.id,
    origin: cluster.origin,
    mode: cluster.mode,
    projectId: row.project_id,
    location: row.location,
    name: row.name,
    gateway: row.gateway,
  };
}

export function connectionRecordOf(row: ClusterRow): ConnectionRecord {
  return {
    id: row.connection_id,
    provider: row.connection_provider as Provider,
    name: row.connection_name,
    layout: row.connection_layout as Layout,
    boundaryRef: row.connection_boundary_ref,
    config: row.connection_config,
  };
}

/** The environment's account config, when the cluster lives in the environment's project. */
export const accountFor = (row: ClusterRow) =>
  row.account_external_id === row.project_id ? (row.account_config ?? {}) : null;
