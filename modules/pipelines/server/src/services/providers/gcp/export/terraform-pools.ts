import type { ExportPool } from '../../export-contract.ts';
import { RUNNER_SERVICE_ACCOUNT } from '../autopilot-manifests.ts';
import { attr, bool, comment, interpolate, nameOf, num, object, str, block } from './hcl.ts';
import type { Terraform } from './terraform-context.ts';
import { gkeCluster } from './terraform-gke.ts';

/*
 * Runner pools. A Cloud Build pool leaves nothing behind to import, so only its settings are
 * kept. A GKE Autopilot pool runs its pods on a cluster in the CI project, which Pipelines
 * made when it was missing, and its pods act as the pool's Google service account through a
 * Workload Identity binding. The pool's namespace and Kubernetes service account are in the
 * runner-pools Helm chart; the pods themselves start and end with each job.
 */

const WORKLOAD_IDENTITY_USER = 'roles/iam.workloadIdentityUser';

type Autopilot = Extract<ExportPool, { kind: 'gke-autopilot' }>;

function settings(pool: ExportPool) {
  if (pool.kind === 'cloud-build') {
    return object({
      kind: str(pool.kind),
      project: str(pool.account),
      region: str(pool.region),
      image: str(pool.image),
      machine: str(pool.machine),
      service_account: str(pool.serviceAccount),
    });
  }
  return object({
    kind: str(pool.kind),
    project: str(pool.account),
    location: str(pool.location),
    cluster: str(pool.cluster.name),
    namespace: str(pool.namespace),
    image: str(pool.image),
    builder_image: str(pool.builderImage),
    cpu: num(pool.cpu),
    memory_gb: num(pool.memoryGb),
    spot: bool(pool.spot),
    service_account: str(pool.serviceAccount),
  });
}

/** "serviceAccount:acme-ci.svc.id.goog[runners/bemmoly-runner]", the pods' identity. */
const podMember = (tf: Terraform, pool: Autopilot) => [
  'serviceAccount:',
  { ref: tf.projectVar(pool.account) },
  `.svc.id.goog[${pool.namespace}/${RUNNER_SERVICE_ACCOUNT}]`,
];

function autopilot(tf: Terraform, pool: Autopilot, clusters: Set<string>) {
  const key = `${pool.account}/${pool.location}/${pool.cluster.name}`;
  if (pool.cluster.create && !clusters.has(key)) {
    clusters.add(key);
    gkeCluster(tf, 'build-pools.tf', {
      projectId: pool.account,
      location: pool.location,
      name: pool.cluster.name,
      mode: 'autopilot',
      labels: object({ 'bemmoly-pool': str(pool.key), 'bemmoly-purpose': str('runners') }),
      note: `The Autopilot cluster the ${pool.key} pool's pods run on.`,
    });
  }
  // The pool's Google service account may live in another project; its email names it.
  const owner =
    /@([^.]+)\.iam\.gserviceaccount\.com$/.exec(pool.serviceAccount)?.[1] ?? pool.account;
  const account = `projects/${owner}/serviceAccounts/${pool.serviceAccount}`;
  tf.add('build-pools.tf', {
    type: 'google_service_account_iam_member',
    name: tf.unique('google_service_account_iam_member', `${pool.key}_pods`),
    note: `Lets the ${pool.key} pool's pods act as ${pool.serviceAccount}.`,
    body: [
      attr('service_account_id', str(account)),
      attr('role', str(WORKLOAD_IDENTITY_USER)),
      attr('member', interpolate(podMember(tf, pool))),
    ],
    importId: interpolate([`${account} ${WORKLOAD_IDENTITY_USER} `, ...podMember(tf, pool)]),
  });
}

export function pools(tf: Terraform): void {
  if (tf.records.pools.length === 0) return;
  const all = Object.fromEntries(
    tf.records.pools.map((pool) => [nameOf(pool.key), settings(pool)]),
  );
  tf.addItems('build-pools.tf', [
    comment(
      'How each runner pool starts its machines. A Cloud Build pool leaves nothing behind to\nimport; an Autopilot pool keeps the cluster and the binding below.',
    ),
    block('locals', [], [attr('runner_pools', object(all))]),
  ]);
  const clusters = new Set<string>();
  for (const pool of tf.records.pools) {
    if (pool.kind === 'gke-autopilot') autopilot(tf, pool, clusters);
  }
}
