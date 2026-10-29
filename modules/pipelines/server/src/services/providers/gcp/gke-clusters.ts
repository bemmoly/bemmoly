import { ValidationError } from '@bemmoly/shared';
import {
  gatewayApiOn,
  GcpApiError,
  serviceAccountEmail,
  type GcpClients,
  type GkeCluster,
} from '../../../clients/gcp/index.ts';
import { serviceAccountMember, withBinding } from '../../../clients/gcp/policy.ts';
import type { ClusterMode } from '../../../../../shared/clusters.ts';
import type { ClusterState, ClustersPart } from '../contract.ts';
import { accountConfigOf, type GcpContexts } from './context.ts';
import { clusterPath, identityFor, type GkeAccess } from './gke-access.ts';
import { clusterSpec } from './gke-cluster-spec.ts';
import { clusterRightsProblems } from './gke-rights.ts';

/*
 * GKE clusters, one per environment. On a managed connection Pipelines creates them in the
 * environment's project, as the control identity, and lets the environment's deployer deploy
 * there. On an attached connection it only checks the cluster it was pointed at: that GKE
 * can see it, the Gateway API is on, and the identity deploys act as may do what a deploy
 * does. It never changes an attached cluster.
 */

const DEPLOYER_ROLE = 'roles/container.developer';
const RUNNING = new Set(['RUNNING', 'RECONCILING', 'DEGRADED']);

const reasonOf = (error: unknown) =>
  error instanceof GcpApiError
    ? `Google Cloud answered ${error.status}: ${error.message}`
    : (error as Error).message;

const denied = (error: unknown) =>
  error instanceof GcpApiError && (error.status === 403 || error.status === 401);

const modeOf = (cluster: GkeCluster): ClusterMode =>
  cluster.autopilot.enabled ? 'autopilot' : 'standard';

function stateOf(cluster: GkeCluster | null, name: string): ClusterState {
  if (!cluster) {
    return {
      status: 'missing',
      mode: null,
      releaseChannel: null,
      message: `GKE has no cluster ${name}`,
    };
  }
  const base = { mode: modeOf(cluster), releaseChannel: cluster.releaseChannel.channel ?? null };
  if (RUNNING.has(cluster.status)) return { ...base, status: 'ready', message: null };
  if (cluster.status === 'PROVISIONING') return { ...base, status: 'creating', message: null };
  return {
    ...base,
    status: 'failed',
    message: cluster.statusMessage ?? `GKE says the cluster is ${cluster.status.toLowerCase()}`,
  };
}

/** The environment's deployer may deploy into the cluster made for it. */
async function grantDeployer(control: GcpClients, projectId: string): Promise<void> {
  const policy = await control.resourceManager.getProjectPolicy(projectId);
  const member = serviceAccountMember(serviceAccountEmail('deployer', projectId));
  const changed = withBinding(policy, DEPLOYER_ROLE, member);
  if (changed) await control.resourceManager.setProjectPolicy(projectId, changed);
}

export function createGkeClusters(contexts: GcpContexts, access: GkeAccess): ClustersPart {
  return {
    async create(connection, input) {
      const context = contexts(connection);
      if (context.config.mode !== 'managed') {
        throw new ValidationError(
          `${connection.name} deploys into projects you already have; attach a cluster there instead`,
        );
      }
      const { control } = context;
      await control.serviceUsage.enable(input.projectId, ['container.googleapis.com']);
      if (!accountConfigOf(input.account ?? {}).deployerServiceAccount) {
        await grantDeployer(control, input.projectId);
      }
      if (await control.container.getCluster(clusterPath(input))) return;
      await control.container.createCluster(
        `projects/${input.projectId}/locations/${input.location}`,
        clusterSpec(input),
      );
    },

    async read(connection, cluster) {
      const found = await contexts(connection).control.container.getCluster(clusterPath(cluster));
      return stateOf(found, cluster.name);
    },

    async verify(connection, cluster, account) {
      const context = contexts(connection);
      const name = cluster.name;
      const deployer = accountConfigOf(account ?? {}).deployerServiceAccount;
      const who = deployer ?? (await context.principal().catch(() => null)) ?? 'Bemmoly';
      const google = identityFor(contexts, connection, cluster, account);
      let found: GkeCluster | null;
      try {
        found = await google.container.getCluster(clusterPath(cluster));
      } catch (error) {
        const problem = denied(error)
          ? `${who} cannot see cluster ${name}. Grant it Kubernetes Engine Cluster Viewer on ${cluster.projectId}`
          : `Bemmoly could not read cluster ${name}. ${reasonOf(error)}`;
        return { ok: false, mode: null, releaseChannel: null, problems: [problem] };
      }
      const state = stateOf(found, name);
      if (!found || state.status !== 'ready') {
        const problem = found
          ? `Cluster ${name} is ${found.status.toLowerCase()}. Check it again once it is running`
          : `Cluster ${name} was not found in ${cluster.projectId}, ${cluster.location}. Check the project, location and name`;
        return {
          ok: false,
          mode: state.mode,
          releaseChannel: state.releaseChannel,
          problems: [problem],
        };
      }
      const critical: string[] = [];
      if (!gatewayApiOn(found)) {
        critical.push(
          `Turn on the Gateway API on ${name}: gcloud container clusters update ${name} --location ${cluster.location} --gateway-api=standard`,
        );
      }
      const rights = await clusterRightsProblems(access, connection, cluster, account, who, {
        gatewayOn: gatewayApiOn(found),
      });
      critical.push(...rights.critical);
      return {
        ok: critical.length === 0,
        mode: state.mode,
        releaseChannel: state.releaseChannel,
        problems: [...critical, ...rights.soft],
      };
    },
  };
}
