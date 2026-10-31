import type { ExportFrontDoor, ExportFrontDoorHost } from '../../export-contract.ts';
import {
  cloudRunBackendName,
  cloudRunGroupName,
  frontDoorNames,
  gkeBackendName,
} from '../front-door-map.ts';
import { attr, block, list, num, str, type Expr, type Item } from './hcl.ts';
import type { Terraform } from './terraform-context.ts';

/*
 * A front door's backend services: Cloud Run's through a serverless endpoint group in the
 * service's region, and each GKE revision's over the zonal groups GKE made for it, which are
 * read as data since GKE makes and removes them itself. Shared ones are declared once.
 */

export const SCHEME = 'EXTERNAL_MANAGED';
type Shares = ExportFrontDoorHost['backends'];

/** A moving host's weights are in flight: all of it to where most of it goes now. */
export function settled(host: ExportFrontDoorHost): Shares {
  if (!host.moving) return host.backends;
  const heaviest = [...host.backends].sort((a, b) => b.percent - a.percent)[0];
  return heaviest ? [{ ...heaviest, percent: 100 }] : [];
}

/** "projects/${var.projects.x}/global/<kind>/<name>". */
export const globalId = (tf: Terraform, account: string, kind: string, name: string) =>
  tf.inProject(account, 'projects/', `/global/${kind}/${name}`);

/** Makes a resource once across the export; answers its Terraform name. */
function once(
  tf: Terraform,
  type: string,
  key: string,
  make: (name: string) => { body: Item[]; importId: Expr },
): string {
  const seen = tf.declared.get(`${type}/${key}`);
  if (seen) return seen;
  const name = tf.unique(type, key.split('/').pop() ?? key);
  tf.declared.set(`${type}/${key}`, name);
  tf.add('front-door.tf', { type, name, ...make(name) });
  return name;
}

export function cloudRunBackend(tf: Terraform, door: ExportFrontDoor, region: string, app: string) {
  const { account } = door;
  const groupName = cloudRunGroupName(app);
  const group = once(
    tf,
    'google_compute_region_network_endpoint_group',
    `${account}/${region}/${groupName}`,
    () => ({
      body: [
        attr('project', tf.projectRef(account)),
        attr('region', str(region)),
        attr('name', str(groupName)),
        attr('network_endpoint_type', str('SERVERLESS')),
        block('cloud_run', [], [attr('service', str(app))]),
      ],
      importId: tf.inProject(
        account,
        'projects/',
        `/regions/${region}/networkEndpointGroups/${groupName}`,
      ),
    }),
  );
  const name = cloudRunBackendName(door.environment, app);
  return once(tf, 'google_compute_backend_service', `${account}/${name}`, () => ({
    body: [
      attr('project', tf.projectRef(account)),
      attr('name', str(name)),
      attr('load_balancing_scheme', str(SCHEME)),
      attr('protocol', str('HTTP')),
      block(
        'backend',
        [],
        [attr('group', `google_compute_region_network_endpoint_group.${group}.id`)],
      ),
    ],
    importId: globalId(tf, account, 'backendServices', name),
  }));
}

function healthCheck(tf: Terraform, door: ExportFrontDoor) {
  const name = frontDoorNames(door.environment).healthCheck;
  return once(tf, 'google_compute_health_check', `${door.account}/${name}`, () => ({
    body: [
      attr('project', tf.projectRef(door.account)),
      attr('name', str(name)),
      block(
        'http_health_check',
        [],
        [attr('port_specification', str('USE_SERVING_PORT')), attr('request_path', str('/'))],
      ),
    ],
    importId: globalId(tf, door.account, 'healthChecks', name),
  }));
}

/** One revision's backend service over the zonal groups GKE made for it. */
export function gkeBackend(
  tf: Terraform,
  door: ExportFrontDoor,
  namespace: string,
  revision: string,
) {
  const name = gkeBackendName(namespace, revision);
  const check = healthCheck(tf, door);
  return once(tf, 'google_compute_backend_service', `${door.account}/${name}`, () => {
    const groups = tf.facts.groups?.[name] ?? [];
    if (groups.length === 0) {
      tf.fill.push(
        `Add a backend to ${name} for each zonal endpoint group GKE made: gcloud compute network-endpoint-groups list --filter="name=${name}" --project ${door.account}`,
      );
    }
    const backends = groups.map((group) => {
      const zone = /\/zones\/([^/]+)\//.exec(group)?.[1] ?? 'zone';
      const data = tf.unique('google_compute_network_endpoint_group', `${name}_${zone}`);
      tf.addItems('front-door.tf', [
        block(
          'data',
          ['google_compute_network_endpoint_group', data],
          [
            attr('project', tf.projectRef(door.account)),
            attr('zone', str(zone)),
            attr('name', str(name)),
          ],
        ),
      ]);
      return block(
        'backend',
        [],
        [
          attr('group', `data.google_compute_network_endpoint_group.${data}.id`),
          attr('balancing_mode', str('RATE')),
          attr('max_rate_per_endpoint', num(100)),
        ],
      );
    });
    return {
      body: [
        attr('project', tf.projectRef(door.account)),
        attr('name', str(name)),
        attr('load_balancing_scheme', str(SCHEME)),
        attr('protocol', str('HTTP')),
        attr('health_checks', list([`google_compute_health_check.${check}.id`])),
        ...backends,
      ],
      importId: globalId(tf, door.account, 'backendServices', name),
    };
  });
}

/** The GKE backend services a front door sends to, whose zonal groups an export reads. */
export function gkeBackendNames(doors: readonly ExportFrontDoor[]) {
  return doors.flatMap((door) =>
    door.hosts.flatMap((host) =>
      settled(host).flatMap((share) =>
        share.runtime !== 'cloud-run' && share.revision
          ? [{ account: door.account, name: gkeBackendName(host.namespace, share.revision) }]
          : [],
      ),
    ),
  );
}
