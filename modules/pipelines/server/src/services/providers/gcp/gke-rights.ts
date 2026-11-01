import type { GkeCluster } from '../../../clients/gcp/index.ts';
import type { AccessQuestion } from '../../../clients/kubernetes/index.ts';
import { KubernetesApiError } from '../../../clients/kubernetes/index.ts';
import type { ClusterRecord, ConnectionRecord } from '../contract.ts';
import type { GkeAccess } from './gke-access.ts';

/*
 * What an attach check asks the cluster itself, as the identity deploys act as: whether it
 * can be reached, whether it serves HTTPRoutes, and whether that identity may write what a
 * deploy writes. Each gap is one sentence saying what to grant. Namespaces are a soft gap,
 * since the cluster's owners may make one per catalog group themselves.
 */

const GATEWAY_GROUP = 'gateway.networking.k8s.io';

const DEPLOY_RIGHTS: readonly AccessQuestion[] = [
  { verb: 'create', group: 'apps', resource: 'deployments' },
  { verb: 'patch', group: 'apps', resource: 'deployments' },
  { verb: 'create', group: '', resource: 'services' },
  { verb: 'patch', group: '', resource: 'services' },
  { verb: 'create', group: GATEWAY_GROUP, resource: 'httproutes' },
  { verb: 'patch', group: GATEWAY_GROUP, resource: 'httproutes' },
];

const reasonOf = (error: unknown) =>
  error instanceof KubernetesApiError
    ? `The cluster answered ${error.status}: ${error.message}`
    : (error as Error).message;

export async function clusterRightsProblems(
  access: GkeAccess,
  connection: ConnectionRecord,
  cluster: ClusterRecord,
  account: Readonly<Record<string, unknown>> | null,
  who: string,
  options: { gatewayOn: boolean; found: GkeCluster },
): Promise<{ critical: string[]; soft: string[] }> {
  const name = cluster.name;
  try {
    const { kube } = await access.open(connection, cluster, account, options.found);
    const critical: string[] = [];
    const soft: string[] = [];
    const served = await kube.served(`${GATEWAY_GROUP}/v1`);
    if (options.gatewayOn && !served?.includes('httproutes')) {
      critical.push(
        `${name} does not serve HTTPRoutes yet. Wait a few minutes after turning the Gateway API on, then check again`,
      );
    }
    const lacking: string[] = [];
    for (const question of DEPLOY_RIGHTS) {
      if (!(await kube.can(question)) && !lacking.includes(question.resource)) {
        lacking.push(question.resource);
      }
    }
    if (lacking.length > 0) {
      critical.push(
        `Grant ${who} rights to create and update ${lacking.join(', ')} in ${name}: Kubernetes Engine Developer on ${cluster.projectId}, or a RoleBinding in each group's namespace`,
      );
    }
    if (
      !cluster.gateway &&
      !(await kube.can({ verb: 'create', group: GATEWAY_GROUP, resource: 'gateways' }))
    ) {
      critical.push(
        `Grant ${who} rights to create Gateways in ${name}, or attach it again naming the Gateway routes should use`,
      );
    }
    const secretRights = [
      { verb: 'create', group: '', resource: 'serviceaccounts' },
      { verb: 'create', group: 'secrets-store.csi.x-k8s.io', resource: 'secretproviderclasses' },
    ];
    const lackingSecrets: string[] = [];
    for (const question of secretRights) {
      if (!(await kube.can(question))) lackingSecrets.push(question.resource);
    }
    if (lackingSecrets.length > 0) {
      soft.push(
        `Grant ${who} rights to create ${lackingSecrets.join(' and ')} in ${name} so applications there can read their secrets`,
      );
    }
    if (!(await kube.can({ verb: 'create', group: '', resource: 'namespaces' }))) {
      soft.push(
        `${who} cannot create namespaces in ${name}. Create one per catalog group yourself, or grant it that right`,
      );
    }
    return { critical, soft };
  } catch (error) {
    return {
      critical: [
        `Bemmoly could not reach the control plane of ${name}. If it is private, add Bemmoly's address to its authorized networks. ${reasonOf(error)}`,
      ],
      soft: [],
    };
  }
}
