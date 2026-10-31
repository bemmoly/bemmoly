import { stringify } from 'yaml';
import type { ExportFile, ExportFrontDoor, ExportService } from '../../export-contract.ts';
import { settingsFor } from '../../../deploy-settings/resolve.ts';
import type { ResolvedDeploySettings } from '../../deploy-settings-contract.ts';
import { imageOf } from '../container.ts';
import { stableServiceOf } from '../gke-scaling.ts';
import { GATEWAY_NAME, kubeRevisionOf, routeHostOf } from '../gke-manifests.ts';
import { gkeBackendName } from '../front-door-map.ts';
import { containerEnv, secretsOf } from '../gke-secrets.ts';
import { DEFAULT_VALUES, TEMPLATES } from './helm-templates.ts';

/*
 * What Pipelines deploys to GKE, as Helm: one chart per catalog group, since a group is one
 * namespace and its applications share the templates and the Gateway, and one values file per
 * application per environment, so each application stays its own release that ships and rolls
 * back alone, as it does in Pipelines. Values hold the image by digest, the resources, the
 * variables and the secrets by reference at their versions.
 */

const DEFAULT_PORT = 8080;

/** The settings a service's last deploy ran with, or the file's when none were recorded. */
export const exportSettingsOf = (service: ExportService): ResolvedDeploySettings =>
  settingsFor(service.release, {
    environmentKey: service.environment.key,
    environmentClass: service.environment.class,
    runtime: service.placement.runtime,
  });

/** One application's values in one environment: what its last deploy there wrote. */
export function valuesOf(service: ExportService, neg = ''): Record<string, unknown> {
  const { release, application } = service;
  const settings = exportSettingsOf(service);
  const namespace = service.placement.namespace;
  const secrets = secretsOf(service.variables);
  const resources = {
    ...(settings.resources.cpu !== null ? { cpu: settings.resources.cpu } : {}),
    ...(settings.resources.memory !== null ? { memory: settings.resources.memory } : {}),
  };
  const { min, max, cpuTarget } = settings.scaling;
  const { path, ready, timeoutSeconds } = settings.healthcheck;
  const gateway = service.placement.cluster?.gateway ?? { name: GATEWAY_NAME, namespace };
  return {
    application,
    revision: service.revision,
    release: release.version,
    image: imageOf(release),
    port: settings.port ?? DEFAULT_PORT,
    scaling: { min: Math.max(1, min), max: Math.max(1, min, max ?? 1), cpuTarget: cpuTarget ?? 70 },
    disruptionBudget:
      settings.maxUnavailable === null ? null : { maxUnavailable: settings.maxUnavailable },
    resources,
    probes: { readiness: ready ?? path ?? '', liveness: path ?? '', timeoutSeconds },
    serviceAccount: secrets.length > 0 ? application : '',
    secretsAs: settings.secretsAs,
    env: containerEnv(service.variables, settings.secretsAs, service.revision),
    secrets: secrets.map((secret) => ({
      path: secret.name,
      resourceName: `projects/${secret.account}/secrets/${secret.secret}/versions/${secret.version}`,
    })),
    stableService: stableServiceOf(application),
    route: {
      hostname: routeHostOf(application, namespace),
      parent: { name: gateway.name, namespace: gateway.namespace },
    },
    gateway: { create: false },
    frontDoor: { neg },
  };
}

const chart = (group: string) => `apiVersion: v2
name: ${group}
description: The ${group} group's applications, as Bemmoly Pipelines deployed them to GKE.
type: application
version: 0.1.0
`;

const header = (service: ExportService) =>
  `# ${service.application} in ${service.environment.key}, release ${service.release.version}, ` +
  `as Pipelines last deployed it.\n`;

/** The revision name GKE knows; Cloud Run's rules, with a letter first. */
export const helmRevisionOf = (service: ExportService) =>
  kubeRevisionOf(service.application, service.release);

/** The endpoint group a front door asked GKE for on this revision, or "" when none. */
function negOf(service: ExportService, doors: readonly ExportFrontDoor[]): string {
  const routed = doors.some((door) =>
    door.hosts.some(
      (host) =>
        door.environment === service.environment.key &&
        host.application === service.application &&
        host.backends.some((share) => share.revision === service.revision),
    ),
  );
  return routed ? gkeBackendName(service.placement.namespace, service.revision) : '';
}

export function helmFiles(
  services: readonly ExportService[],
  doors: readonly ExportFrontDoor[] = [],
): ExportFile[] {
  const onGke = services.filter((service) => service.placement.runtime !== 'cloud-run');
  const groups = new Map<string, ExportService[]>();
  for (const service of onGke) {
    groups.set(service.placement.namespace, [
      ...(groups.get(service.placement.namespace) ?? []),
      service,
    ]);
  }
  const files: ExportFile[] = [];
  for (const [group, members] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const root = `helm/${group}`;
    files.push({ path: `${root}/Chart.yaml`, content: chart(group) });
    files.push({ path: `${root}/values.yaml`, content: DEFAULT_VALUES });
    for (const [name, content] of Object.entries(TEMPLATES)) {
      files.push({ path: `${root}/templates/${name}`, content });
    }
    const gateways = new Set<string>();
    for (const service of members) {
      const env = service.environment.key;
      files.push({
        path: `${root}/values/${env}/${service.application}.yaml`,
        content: header(service) + stringify(valuesOf(service, negOf(service, doors))),
      });
      if (!service.placement.cluster?.gateway && !gateways.has(env)) {
        gateways.add(env);
        files.push({
          path: `${root}/values/${env}/gateway.yaml`,
          content: `# The ${group} namespace's Gateway in ${env}, which every route here attaches to.\ngateway:\n  create: true\n`,
        });
      }
    }
  }
  return files;
}
