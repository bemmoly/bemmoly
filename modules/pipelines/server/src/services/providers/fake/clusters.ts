import type { ClusterMode } from '../../../../../shared/clusters.ts';
import type { ClusterRecord, ClustersPart } from '../contract.ts';

/*
 * Simulated GKE clusters. A created cluster reports "creating" until it is read once, then
 * runs, so a test sees both states without waiting. Any cluster that was not created here
 * attaches cleanly as Autopilot, unless the world lists problems for its name.
 */

export interface FakeCluster {
  mode: ClusterMode;
  status: 'creating' | 'ready';
  releaseChannel: string;
  labels: Readonly<Record<string, string>>;
}

export interface FakeClustersWorld {
  /** By "project/location/name". */
  clusters: Map<string, FakeCluster>;
  /** Cluster names an attach check finds problems in. */
  clusterProblems: Map<string, string[]>;
  log: string[];
}

export const clusterKey = (cluster: Pick<ClusterRecord, 'projectId' | 'location' | 'name'>) =>
  `${cluster.projectId}/${cluster.location}/${cluster.name}`;

export function createFakeClusters(world: FakeClustersWorld): ClustersPart {
  return {
    async create(_connection, input) {
      const key = clusterKey(input);
      if (!world.clusters.has(key)) {
        world.clusters.set(key, {
          mode: input.mode,
          status: 'creating',
          releaseChannel: 'REGULAR',
          labels: input.labels,
        });
        world.log.push(`create cluster ${key} ${input.mode}`);
      }
    },

    async read(_connection, cluster) {
      const found = world.clusters.get(clusterKey(cluster));
      if (!found) {
        return { status: 'missing', mode: null, releaseChannel: null, message: 'No such cluster' };
      }
      const state = {
        status: found.status,
        mode: found.mode,
        releaseChannel: found.releaseChannel,
      };
      found.status = 'ready';
      return { ...state, message: null };
    },

    async verify(_connection, cluster) {
      const found = world.clusters.get(clusterKey(cluster));
      const problems = world.clusterProblems.get(cluster.name) ?? [];
      return {
        ok: problems.length === 0,
        mode: found?.mode ?? 'autopilot',
        releaseChannel: found?.releaseChannel ?? 'REGULAR',
        problems,
      };
    },
  };
}
