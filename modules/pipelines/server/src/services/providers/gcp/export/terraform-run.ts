import { serviceAccountEmail } from '../../../../clients/gcp/index.ts';
import type { ExportService } from '../../export-contract.ts';
import { imageOf } from '../container.ts';
import { accountConfigOf } from '../context.ts';
import { memberOf } from '../registry-secrets.ts';
import { envOf, filesOf } from '../revision-secrets.ts';
import { exportSettingsOf } from './helm.ts';
import { attr, block, interpolate, list, num, object, str, type Item } from './hcl.ts';
import type { Terraform } from './terraform-context.ts';
import { grantReader, type Reader } from './terraform-secrets.ts';

/*
 * The Cloud Run service of each application in each environment, as its serving release left
 * it: the image by digest, scaling, port, CPU and memory, health checks, variables and
 * secrets by reference at their versions (or as files), and public access. The revision history and the canary's
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

const envItem = (entry: ReturnType<typeof envOf>[number]): Item =>
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
      );

const probeOf = (name: string, path: string, timeout: number): Item =>
  block(
    name,
    [],
    [
      attr('timeout_seconds', num(Math.min(240, timeout))),
      attr('period_seconds', num(Math.min(240, Math.max(10, timeout)))),
      block('http_get', [], [attr('path', str(path))]),
    ],
  );

/** Secrets as files: each version in its own volume, as Pipelines' deploy mounts them. */
const filesFor = (service: ExportService) =>
  exportSettingsOf(service).secretsAs === 'files'
    ? filesOf(service.account.externalId, service.variables)
    : null;

function container(service: ExportService): Item[] {
  const { release } = service;
  const settings = exportSettingsOf(service);
  const port = settings.port;
  const limits: Record<string, string> = {
    ...(settings.resources.cpu !== null ? { cpu: str(settings.resources.cpu) } : {}),
    ...(settings.resources.memory !== null ? { memory: str(settings.resources.memory) } : {}),
  };
  const files = filesFor(service);
  const env = files
    ? files.env.map((entry) => envItem(entry))
    : envOf(service.account.externalId, service.variables).map(envItem);
  const { path, ready, timeoutSeconds } = settings.healthcheck;
  const startup = ready ?? path;
  return [
    attr('image', str(imageOf(release))),
    ...(port ? [block('ports', [], [attr('container_port', num(port))])] : []),
    ...(Object.keys(limits).length > 0
      ? [block('resources', [], [attr('limits', object(limits))])]
      : []),
    ...(startup ? [probeOf('startup_probe', startup, timeoutSeconds)] : []),
    ...(path ? [probeOf('liveness_probe', path, timeoutSeconds)] : []),
    ...env,
    ...(files?.mounts ?? []).map((mount) =>
      block(
        'volume_mounts',
        [],
        [attr('name', str(mount.name)), attr('mount_path', str(mount.mountPath))],
      ),
    ),
  ];
}

/** The revision's scaling and secret volumes, beside its container. */
function revisionExtras(service: ExportService): Item[] {
  const { min, max, concurrency } = exportSettingsOf(service).scaling;
  const files = filesFor(service);
  return [
    block(
      'scaling',
      [],
      [
        attr('min_instance_count', num(min)),
        ...(max !== null ? [attr('max_instance_count', num(max))] : []),
      ],
    ),
    ...(concurrency !== null ? [attr('max_instance_request_concurrency', num(concurrency))] : []),
    ...(files?.volumes ?? []).map((volume) =>
      block(
        'volumes',
        [],
        [
          attr('name', str(volume.name)),
          block(
            'secret',
            [],
            [
              attr('secret', str(volume.secret.secret)),
              ...volume.secret.items.map((item) =>
                block(
                  'items',
                  [],
                  [attr('path', str(item.path)), attr('version', str(item.version))],
                ),
              ),
            ],
          ),
        ],
      ),
    ),
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
          ...revisionExtras(service),
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
  if (exportSettingsOf(service).public) {
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
    if (service.moving) tf.moving.push(`${service.application} in ${service.environment.key}`);
    const reader =
      service.placement.runtime === 'cloud-run' ? cloudRun(tf, service) : podReader(tf, service);
    if (!reader) continue;
    for (const variable of service.variables) {
      if (variable.kind === 'secret') grantReader(tf, variable, reader);
    }
  }
}
