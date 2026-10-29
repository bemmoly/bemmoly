import type { ExportCluster } from '../../export-contract.ts';
import { MAINTENANCE, RELEASE_CHANNEL, STANDARD_POOL } from '../gke-cluster-spec.ts';
import { attr, block, bool, list, num, str, type HclObject, type Item } from './hcl.ts';
import type { Terraform, TerraformFile } from './terraform-context.ts';
import { managedLabels } from './terraform-zone.ts';

/*
 * Clusters Pipelines created, as gke-cluster-spec.ts asked GKE for them: the Regular release
 * channel, the weekend maintenance window, Workload Identity, the Gateway API and the Secret
 * Manager add-on, and on Standard the one autoscaling node pool. A cluster someone attached
 * was never Pipelines' to make, so only what Pipelines deployed into it is exported (Helm).
 */

function nodePool(): Item {
  return block(
    'node_pool',
    [],
    [
      attr('name', str(STANDARD_POOL.name)),
      attr('initial_node_count', num(STANDARD_POOL.minNodeCount)),
      block(
        'autoscaling',
        [],
        [
          attr('min_node_count', num(STANDARD_POOL.minNodeCount)),
          attr('max_node_count', num(STANDARD_POOL.maxNodeCount)),
        ],
      ),
      block('management', [], [attr('auto_upgrade', bool(true)), attr('auto_repair', bool(true))]),
      block(
        'node_config',
        [],
        [
          attr('machine_type', str(STANDARD_POOL.machineType)),
          attr('oauth_scopes', list([str('https://www.googleapis.com/auth/cloud-platform')])),
          block('workload_metadata_config', [], [attr('mode', str('GKE_METADATA'))]),
        ],
      ),
    ],
  );
}

/** A cluster as gke-cluster-spec.ts asks GKE for it, labelled as its maker labelled it. */
export function gkeCluster(
  tf: Terraform,
  file: TerraformFile,
  record: Pick<ExportCluster, 'projectId' | 'location' | 'name' | 'mode'> & {
    labels: HclObject;
    note: string;
  },
) {
  const autopilot = record.mode === 'autopilot';
  tf.add(file, {
    type: 'google_container_cluster',
    name: tf.unique('google_container_cluster', record.name),
    note: record.note,
    body: [
      attr('project', tf.projectRef(record.projectId)),
      attr('location', str(record.location)),
      attr('name', str(record.name)),
      ...(autopilot ? [attr('enable_autopilot', bool(true))] : []),
      attr('resource_labels', record.labels),
      block('release_channel', [], [attr('channel', str(RELEASE_CHANNEL))]),
      block(
        'maintenance_policy',
        [],
        [
          block(
            'recurring_window',
            [],
            [
              attr('start_time', str(MAINTENANCE.startTime)),
              attr('end_time', str(MAINTENANCE.endTime)),
              attr('recurrence', str(MAINTENANCE.recurrence)),
            ],
          ),
        ],
      ),
      block(
        'workload_identity_config',
        [],
        [attr('workload_pool', tf.inProject(record.projectId, '', '.svc.id.goog'))],
      ),
      block('gateway_api_config', [], [attr('channel', str('CHANNEL_STANDARD'))]),
      block('secret_manager_config', [], [attr('enabled', bool(true))]),
      block('ip_allocation_policy', [], []),
      ...(autopilot ? [] : [nodePool()]),
    ],
    importId: tf.inProject(
      record.projectId,
      'projects/',
      `/locations/${record.location}/clusters/${record.name}`,
    ),
  });
}

export function clusters(tf: Terraform): void {
  for (const record of tf.records.clusters) {
    if (record.origin !== 'created') continue;
    gkeCluster(tf, 'clusters.tf', {
      ...record,
      labels: managedLabels({ environment: record.environment }),
      note: `${record.environment}'s cluster, GKE ${record.mode === 'autopilot' ? 'Autopilot' : 'Standard'}.`,
    });
  }
}
