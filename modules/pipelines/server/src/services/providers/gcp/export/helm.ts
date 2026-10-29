import { stringify } from 'yaml';
import type { ExportFile, ExportService } from '../../export-contract.ts';
import { deploySettingsOf, imageOf } from '../container.ts';
import { GATEWAY_NAME, kubeRevisionOf, routeHostOf } from '../gke-manifests.ts';
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

const portOf = (value: unknown): number => {
  const port = typeof value === 'string' ? Number(value) : value;
  return typeof port === 'number' && Number.isInteger(port) && port > 0 && port < 65536
    ? port
    : DEFAULT_PORT;
};

/** One application's values in one environment: what its last deploy there wrote. */
export function valuesOf(service: ExportService): Record<string, unknown> {
  const { release, application } = service;
  const settings = deploySettingsOf(release);
  const namespace = service.placement.namespace;
  const secrets = secretsOf(service.variables);
  const resources = {
    ...(settings.resources?.cpu !== undefined ? { cpu: String(settings.resources.cpu) } : {}),
    ...(settings.resources?.memory ? { memory: settings.resources.memory } : {}),
  };
  const gateway = service.placement.cluster?.gateway ?? { name: GATEWAY_NAME, namespace };
  return {
    application,
    revision: service.revision,
    release: release.version,
    image: imageOf(release),
    port: portOf(settings.port),
    replicas: 1,
    resources,
    healthcheck: settings.healthcheck ?? null,
    serviceAccount: secrets.length > 0 ? application : '',
    env: containerEnv(service.variables),
    secrets: secrets.map((secret) => ({
      path: secret.name,
      resourceName: `projects/${secret.account}/secrets/${secret.secret}/versions/${secret.version}`,
    })),
    route: {
      hostname: routeHostOf(application, namespace),
      parent: { name: gateway.name, namespace: gateway.namespace },
    },
    gateway: { create: false },
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

export function helmFiles(services: readonly ExportService[]): ExportFile[] {
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
        content: header(service) + stringify(valuesOf(service)),
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
