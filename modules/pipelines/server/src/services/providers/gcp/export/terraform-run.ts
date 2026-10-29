import { serviceAccountEmail } from '../../../../clients/gcp/index.ts';
import type { ExportService } from '../../export-contract.ts';
import { deploySettingsOf, imageOf, portOf } from '../container.ts';
import { accountConfigOf } from '../context.ts';
import { memberOf } from '../registry-secrets.ts';
import { envOf } from '../revision-secrets.ts';
import { attr, block, interpolate, list, num, object, str, type Item } from './hcl.ts';
import type { Terraform } from './terraform-context.ts';
import { grantReader, type Reader } from './terraform-secrets.ts';

/*
 * The Cloud Run service of each application in each environment, as its serving release left
 * it: the image by digest, port, CPU and memory, health check, variables and secrets by
 * reference at their versions, and public access. The revision history and the canary's
 * weights stay out: traffic is ignored, so Terraform never moves it on its own.
 */

const regionOf = (tf: Terraform, service: ExportService) =>
  service.environment.region ?? String(tf.records.connection.config['region'] ?? 'us-central1');

/** Who the service runs as, as Pipelines chose: the account's own, `runtime`, or the default. */
function runsAs(tf: Terraform, service: ExportService): { email: string | null; reader: Reader } {
  const project = service.account.externalId;
  const managed = (tf.records.connection.config['mode'] ?? 'managed') === 'managed';
  const email =
    accountConfigOf(service.account.config).runtimeServiceAccount ??
    (managed ? serviceAccountEmail('runtime', project) : null);
  if (!email) {
    // Cloud Run's default: the project's Compute Engine account, named by its number.
    const parts = [
      'serviceAccount:',
      { ref: tf.numberVar(project) },
      '-compute@developer.gserviceaccount.com',
    ];
    return { email: null, reader: { key: 'compute', expr: interpolate(parts), parts } };
  }
  const declared = tf.identities.get(`runtime@${project}`);
  const ours = email === serviceAccountEmail('runtime', project);
  const parts = ours
    ? ['serviceAccount:runtime@', { ref: tf.projectVar(project) }, '.iam.gserviceaccount.com']
    : [memberOf(email)];
  return {
    email,
    reader: {
      key: ours ? 'runtime' : (email.split('@')[0] ?? email),
      expr: declared && ours ? `google_service_account.${declared}.member` : interpolate(parts),
      parts,
    },
  };
}

function container(service: ExportService): Item[] {
  const { release } = service;
  const settings = deploySettingsOf(release);
  const port = portOf(settings.port);
  const limits: Record<string, string> = {
    ...(settings.resources?.cpu !== undefined ? { cpu: str(String(settings.resources.cpu)) } : {}),
    ...(settings.resources?.memory ? { memory: str(settings.resources.memory) } : {}),
  };
  const env = envOf(service.account.externalId, service.variables).map((entry) =>
    entry.valueSource === undefined
      ? block('env', [], [attr('name', str(entry.name)), attr('value', str(entry.value ?? ''))])
      : block(
          'env',
          [],
          [
            attr('name', str(entry.name)),
            block(
              'value_source',
              [],
              [
                block(
                  'secret_key_ref',
                  [],
                  [
                    attr('secret', str(entry.valueSource.secretKeyRef.secret)),
                    attr('version', str(entry.valueSource.secretKeyRef.version)),
                  ],
                ),
              ],
            ),
          ],
        ),
  );
  const probe = settings.healthcheck;
  return [
    attr('image', str(imageOf(release))),
    ...(port ? [block('ports', [], [attr('container_port', num(port))])] : []),
    ...(Object.keys(limits).length > 0
      ? [block('resources', [], [attr('limits', object(limits))])]
      : []),
    ...(probe
      ? [
          block(
            'startup_probe',
            [],
            [
              attr('timeout_seconds', num(Math.min(240, probe.timeoutSeconds))),
              attr('period_seconds', num(Math.min(240, Math.max(10, probe.timeoutSeconds)))),
              block('http_get', [], [attr('path', str(probe.path))]),
            ],
          ),
        ]
      : []),
    ...env,
  ];
}

function cloudRun(tf: Terraform, service: ExportService) {
  const project = service.account.externalId;
  const region = regionOf(tf, service);
  const name = tf.unique(
    'google_cloud_run_v2_service',
    `${service.application}_${service.environment.key}`,
  );
  const { email, reader } = runsAs(tf, service);
  const declared = tf.identities.get(`runtime@${project}`);
  const account =
    email && declared && email === serviceAccountEmail('runtime', project)
      ? `google_service_account.${declared}.email`
      : email
        ? str(email)
        : null;
  tf.add('cloud-run.tf', {
    type: 'google_cloud_run_v2_service',
    name,
    note: `${service.application} in ${service.environment.key}: release ${service.release.version}.`,
    body: [
      attr('project', tf.projectRef(project)),
      attr('location', str(region)),
      attr('name', str(service.application)),
      block(
        'template',
        [],
        [
          attr('revision', str(service.revision)),
          ...(account ? [attr('service_account', account)] : []),
          block('containers', [], container(service)),
        ],
      ),
      block(
        'traffic',
        [],
        [
          attr('type', str('TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION')),
          attr('revision', str(service.revision)),
          attr('percent', num(100)),
        ],
      ),
      block('lifecycle', [], [attr('ignore_changes', list(['traffic']))]),
    ],
    importId: tf.inProject(
      project,
      'projects/',
      `/locations/${region}/services/${service.application}`,
    ),
  });
  if (deploySettingsOf(service.release).public) {
    tf.add('cloud-run.tf', {
      type: 'google_cloud_run_v2_service_iam_member',
      name: tf.unique('google_cloud_run_v2_service_iam_member', `${name}_public`),
      body: [
        attr('project', `google_cloud_run_v2_service.${name}.project`),
        attr('location', `google_cloud_run_v2_service.${name}.location`),
        attr('name', `google_cloud_run_v2_service.${name}.name`),
        attr('role', str('roles/run.invoker')),
        attr('member', str('allUsers')),
      ],
      importId: tf.inProject(
        project,
        'projects/',
        `/locations/${region}/services/${service.application} roles/run.invoker allUsers`,
      ),
    });
  }
  return reader;
}

/** On GKE, pods read secrets as their Kubernetes service account's Workload Identity. */
function podReader(tf: Terraform, service: ExportService): Reader | null {
  const cluster = service.placement.cluster;
  if (!cluster) return null;
  const parts = [
    'principal://iam.googleapis.com/projects/',
    { ref: tf.numberVar(cluster.projectId) },
    `/locations/global/workloadIdentityPools/${cluster.projectId}.svc.id.goog/subject/ns/${service.placement.namespace}/sa/${service.application}`,
  ];
  return {
    key: `${service.placement.namespace}_${service.application}`,
    expr: interpolate(parts),
    parts,
  };
}

export function services(tf: Terraform): void {
  for (const service of tf.records.services) {
    if (service.moving) {
      tf.fill.push(
        `${service.application} in ${service.environment.key}: a deploy after ${service.release.version} did not finish, so what runs may be newer than this export. A plan or helm diff shows it going back to ${service.release.version}; apply only if that is what you want.`,
      );
    }
    const reader =
      service.placement.runtime === 'cloud-run' ? cloudRun(tf, service) : podReader(tf, service);
    if (!reader) continue;
    for (const variable of service.variables) {
      if (variable.kind === 'secret') grantReader(tf, variable, reader);
    }
  }
}
