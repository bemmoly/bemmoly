import { GcpApiError, type GcpClients, type GkeCluster } from '../../../clients/gcp/index.ts';
import { withBinding } from '../../../clients/gcp/policy.ts';
import { KubernetesApiError, type KubernetesObject } from '../../../clients/kubernetes/index.ts';
import type { PodPoolSite, PodPoolState, RunnersPart } from '../runners-contract.ts';
import { clusterPathOf, parsePodRef, poolRefOf, type PodAccess } from './autopilot-access.ts';
import {
  poolNamespaceManifest,
  runnerServiceAccountManifest,
  WARM_ROOM,
  warmPriorityClassManifest,
  warmRoomManifest,
  workloadMember,
} from './autopilot-manifests.ts';
import type { GcpContexts } from './context.ts';
import { clusterSpec } from './gke-cluster-spec.ts';

/*
 * Preparing a GKE Autopilot runner pool, one step a sweep until it is ready: the cluster
 * (created in the CI project on a managed connection when asked, otherwise one that is there
 * already), the pool's namespace, the service account its pods run as and the Workload
 * Identity binding that lets it act as the pool's Google service account, and the warm room.
 * Every step is safe to repeat, so a sweep that stops halfway picks up where it left off.
 */

const WORKLOAD_IDENTITY_USER = 'roles/iam.workloadIdentityUser';
const RUNNING = new Set(['RUNNING', 'RECONCILING', 'DEGRADED']);

const readyOf = (room: KubernetesObject | null) => {
  const ready = room?.status?.['readyReplicas'];
  return typeof ready === 'number' ? ready : 0;
};

/** Lets the pods' Kubernetes service account act as the pool's Google one; a problem or null. */
async function bindWorkloadIdentity(
  google: GcpClients,
  cluster: GkeCluster,
  site: PodPoolSite,
): Promise<string | null> {
  const workloadPool =
    cluster.workloadIdentityConfig.workloadPool ?? `${site.account.externalId}.svc.id.goog`;
  const member = workloadMember(workloadPool, site.namespace);
  const email = site.serviceAccount;
  try {
    const policy = await google.iam.getServiceAccountPolicy(email);
    const changed = withBinding(policy, WORKLOAD_IDENTITY_USER, member);
    if (changed) await google.iam.setServiceAccountPolicy(email, changed);
    return null;
  } catch (error) {
    if (!(error instanceof GcpApiError)) throw error;
    if (error.status === 404) {
      return `The service account ${email} does not exist. Create it, or name one that does`;
    }
    if (error.status === 403) {
      return `Pipelines may not let the pool's pods act as ${email}. Run: gcloud iam service-accounts add-iam-policy-binding ${email} --role ${WORKLOAD_IDENTITY_USER} --member "${member}"`;
    }
    throw error;
  }
}

export function createAutopilotPools(
  contexts: GcpContexts,
  access: PodAccess,
): Required<Pick<RunnersPart, 'ensurePool' | 'readPool'>> {
  return {
    async ensurePool(connection, site) {
      const project = site.account.externalId;
      const { location, name } = site.cluster;
      const path = clusterPathOf(project, location, name);
      const ref = poolRefOf(path, site.namespace);
      const state = (status: PodPoolState['status'], detail: string | null, warm = 0) => ({
        ref,
        status,
        detail,
        warm,
      });
      const google = access.google(connection, site.account);
      let found: GkeCluster | null;
      try {
        found = await google.container.getCluster(path);
      } catch (error) {
        if (error instanceof GcpApiError && error.status === 403) {
          return state(
            'failed',
            `Pipelines cannot see cluster ${name} in ${project}. Grant it Kubernetes Engine Admin on ${project}`,
          );
        }
        throw error;
      }
      if (!found) {
        if (!site.cluster.create || contexts(connection).config.mode !== 'managed') {
          return state(
            'failed',
            `Cluster ${name} was not found in ${project}, ${location}. Create it, or check the project, location and name`,
          );
        }
        await google.serviceUsage.enable(project, ['container.googleapis.com']);
        await google.container.createCluster(
          `projects/${project}/locations/${location}`,
          clusterSpec({
            projectId: project,
            name,
            mode: 'autopilot',
            labels: { 'bemmoly-purpose': 'runners', 'bemmoly-pool': site.pool },
          }),
        );
        return state('preparing', `Creating Autopilot cluster ${name} in ${project}`);
      }
      if (found.status === 'PROVISIONING') {
        return state('preparing', `GKE is creating cluster ${name}`);
      }
      if (!RUNNING.has(found.status)) {
        return state(
          'failed',
          found.statusMessage ?? `GKE says cluster ${name} is ${found.status.toLowerCase()}`,
        );
      }
      if (!found.autopilot.enabled) {
        return state(
          'failed',
          `${name} is a Standard cluster. Pick an Autopilot cluster, where each runner pod gets the size it asks for`,
        );
      }
      try {
        const { kube } = await access.open(connection, site.account, path, found);
        await kube.apply(poolNamespaceManifest(site));
        await kube.apply(runnerServiceAccountManifest(site));
        const problem = await bindWorkloadIdentity(google, found, site);
        if (problem) return state('failed', problem);
        if (site.warm === 0) {
          await kube.remove('Deployment', WARM_ROOM, site.namespace);
          return state('ready', null);
        }
        await kube.apply(warmPriorityClassManifest());
        return state('ready', null, readyOf(await kube.apply(warmRoomManifest(site))));
      } catch (error) {
        if (error instanceof KubernetesApiError && error.status === 403) {
          return state(
            'failed',
            `Cluster ${name} refused Pipelines: ${error.message}. Grant it Kubernetes Engine Admin on ${project}`,
          );
        }
        throw error;
      }
    },

    async readPool(connection, input) {
      const ref = parsePodRef(input.ref);
      if (!ref) return { warm: 0 };
      const { kube } = await access.open(connection, input.account, ref.cluster);
      return { warm: readyOf(await kube.get('Deployment', WARM_ROOM, ref.namespace)) };
    },
  };
}
