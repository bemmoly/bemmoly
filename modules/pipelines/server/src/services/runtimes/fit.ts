import type { ClusterMode, ClusterOrigin, ClusterStatus } from '../../../../shared/clusters.ts';
import type { DeployRuntime } from '../../../../shared/common.ts';

/*
 * Whether an application can deploy on its runtime in an environment, in the one sentence a
 * person reads on the runtime card and a failed deploy reports. An environment has one
 * cluster: GKE Autopilot and GKE Standard need one Pipelines created in that mode, and an
 * attached cluster needs one that was attached.
 */

export const RUNTIME_NAMES: Record<DeployRuntime, string> = {
  'cloud-run': 'Cloud Run',
  'gke-autopilot': 'GKE Autopilot',
  'gke-standard': 'GKE Standard',
  'attached-cluster': 'an attached cluster',
};

export interface FitInput {
  runtime: DeployRuntime;
  application: string;
  environment: string;
  cluster: { name: string; origin: ClusterOrigin; mode: ClusterMode; status: ClusterStatus } | null;
  /** Whether the environment's cloud has deploy parts for this runtime at all. */
  supported: boolean;
}

/** What a cluster is, in the runtime's words. */
export function runtimeOfCluster(cluster: {
  origin: ClusterOrigin;
  mode: ClusterMode;
}): DeployRuntime {
  if (cluster.origin === 'attached') return 'attached-cluster';
  return cluster.mode === 'standard' ? 'gke-standard' : 'gke-autopilot';
}

export function runtimeProblem(input: FitInput): string | null {
  const { runtime, application, environment, cluster } = input;
  if (runtime === 'cloud-run') return null;
  const name = RUNTIME_NAMES[runtime];
  if (!input.supported) {
    return `${environment} cannot run applications on ${name} yet. Switch ${application} back to Cloud Run there`;
  }
  if (!cluster) {
    return `${environment} has no cluster yet. Create or attach one in Platform › Clusters, or switch ${application} back to Cloud Run`;
  }
  const fits = runtimeOfCluster(cluster);
  if (fits !== runtime) {
    return `${environment}'s cluster ${cluster.name} is ${RUNTIME_NAMES[fits]}, not ${name}. Choose ${RUNTIME_NAMES[fits]} for ${application}, or Cloud Run`;
  }
  if (cluster.status === 'creating') {
    return `${environment}'s cluster ${cluster.name} is still being created. Deploy again once it is ready`;
  }
  if (cluster.status === 'failed') {
    return `${environment}'s cluster ${cluster.name} failed its last check. Fix what it found in Platform › Clusters, then check it again`;
  }
  return null;
}
