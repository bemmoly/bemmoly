import type { ClusterMode } from '../../../../../shared/clusters.ts';

/*
 * The cluster Pipelines creates for an environment, as GKE's create call takes it: the
 * Regular release channel, a weekend maintenance window, Workload Identity, the Gateway API
 * and the Secret Manager add-on on, and for Standard a default node pool that autoscales and repairs itself. GKE wants
 * at least 48 hours of maintenance window in any 32 days, so each weekend day gets eight.
 */

export const RELEASE_CHANNEL = 'REGULAR';
export const MAINTENANCE = {
  /** A Saturday; only the time of day and the recurrence matter. */
  startTime: '2026-01-03T01:00:00Z',
  endTime: '2026-01-03T09:00:00Z',
  recurrence: 'FREQ=WEEKLY;BYDAY=SA,SU',
};
export const STANDARD_POOL = {
  name: 'default-pool',
  machineType: 'e2-standard-4',
  minNodeCount: 1,
  maxNodeCount: 3,
};

export function clusterSpec(input: {
  projectId: string;
  name: string;
  mode: ClusterMode;
  labels: Readonly<Record<string, string>>;
}): Record<string, unknown> {
  const shared = {
    name: input.name,
    resourceLabels: input.labels,
    releaseChannel: { channel: RELEASE_CHANNEL },
    maintenancePolicy: {
      window: {
        recurringWindow: {
          window: { startTime: MAINTENANCE.startTime, endTime: MAINTENANCE.endTime },
          recurrence: MAINTENANCE.recurrence,
        },
      },
    },
    workloadIdentityConfig: { workloadPool: `${input.projectId}.svc.id.goog` },
    networkConfig: { gatewayApiConfig: { channel: 'CHANNEL_STANDARD' } },
    secretManagerConfig: { enabled: true },
    ipAllocationPolicy: { useIpAliases: true },
  };
  if (input.mode === 'autopilot') return { ...shared, autopilot: { enabled: true } };
  return {
    ...shared,
    nodePools: [
      {
        name: STANDARD_POOL.name,
        initialNodeCount: STANDARD_POOL.minNodeCount,
        autoscaling: {
          enabled: true,
          minNodeCount: STANDARD_POOL.minNodeCount,
          maxNodeCount: STANDARD_POOL.maxNodeCount,
        },
        management: { autoUpgrade: true, autoRepair: true },
        config: {
          machineType: STANDARD_POOL.machineType,
          workloadMetadataConfig: { mode: 'GKE_METADATA' },
          oauthScopes: ['https://www.googleapis.com/auth/cloud-platform'],
        },
      },
    ],
  };
}
