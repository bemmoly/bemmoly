import { LATEST_TARGET, runServiceName, type RunService } from '../../../clients/gcp/index.ts';
import type { FlatDeploySettings } from '../../../../../shared/deploy-settings.ts';
import type { AdoptPart, RunningService, RunningVariable, ServicePlace } from '../contract.ts';
import { accountConfigOf, type GcpContext, type GcpContexts } from './context.ts';
import { workloadPrincipal } from './gke-secrets.ts';
import { defaultRuntimeAccount } from './revision-secrets.ts';

/*
 * Cloud Run services that already run, read as the deployer the project names: their
 * environment, scaling, resources, port, probes, and the image by digest. A secret is read
 * as its name and version only; "latest" is pinned to the number it points at now, which
 * Secret Manager answers without the value.
 */

type Container = {
  image?: string;
  env?: Array<{
    name?: string;
    value?: string;
    valueSource?: { secretKeyRef?: { secret?: string; version?: string } };
  }>;
  ports?: Array<{ containerPort?: number }>;
  resources?: { limits?: Record<string, string> };
  startupProbe?: { httpGet?: { path?: string } };
  livenessProbe?: { httpGet?: { path?: string } };
};

const shortName = (name: string | undefined) => name?.split('/').pop() ?? null;

/** The revision taking the most traffic now. */
function servingRevision(service: RunService): string | null {
  const heaviest = [...service.trafficStatuses].sort(
    (a, b) => (b.percent ?? 0) - (a.percent ?? 0),
  )[0];
  if (heaviest?.revision) return heaviest.revision;
  if (!heaviest || heaviest.type === LATEST_TARGET) return shortName(service.latestReadyRevision);
  return null;
}

function splitImage(image: string | null | undefined) {
  const at = image?.indexOf('@sha256:') ?? -1;
  if (!image || at < 0) return null;
  return { repository: image.slice(0, at), digest: image.slice(at + 1) };
}

/** Only what the service sets, in deploy settings' words. */
export function settingsOfService(service: RunService): FlatDeploySettings {
  const template = service.template as {
    scaling?: { minInstanceCount?: number; maxInstanceCount?: number };
    maxInstanceRequestConcurrency?: number;
    containers?: Container[];
  };
  const container = template.containers?.[0] ?? {};
  const liveness = container.livenessProbe?.httpGet?.path;
  const startup = container.startupProbe?.httpGet?.path;
  const entries: Array<[keyof FlatDeploySettings, number | string | undefined]> = [
    ['scaling.min', template.scaling?.minInstanceCount],
    ['scaling.max', template.scaling?.maxInstanceCount],
    ['scaling.concurrency', template.maxInstanceRequestConcurrency],
    ['resources.cpu', container.resources?.limits?.['cpu']],
    ['resources.memory', container.resources?.limits?.['memory']],
    ['port', container.ports?.[0]?.containerPort],
    ['healthcheck.path', liveness],
    ['healthcheck.ready', startup && startup !== liveness ? startup : undefined],
  ];
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
}

async function variablesOf(
  context: GcpContext,
  projectId: string,
  container: Container,
): Promise<RunningVariable[]> {
  const variables: RunningVariable[] = [];
  for (const entry of container.env ?? []) {
    if (!entry.name) continue;
    const ref = entry.valueSource?.secretKeyRef;
    if (!ref?.secret) {
      variables.push({ name: entry.name, kind: 'plain', value: entry.value ?? '' });
      continue;
    }
    // "projects/<id or number>/secrets/<name>" names another project; a short name, this one.
    const parts = ref.secret.split('/');
    const named = parts.length === 4 ? (parts[1] ?? projectId) : projectId;
    const secret = parts.at(-1) ?? ref.secret;
    const account = /^\d+$/.test(named)
      ? ((await context.control.resourceManager.getProject(named))?.projectId ?? named)
      : named;
    const wanted = ref.version ?? 'latest';
    const version = /^\d+$/.test(wanted)
      ? wanted
      : await context.control.secretManager.versionNumber(account, secret, wanted);
    variables.push({ name: entry.name, kind: 'secret', account, secret, version });
  }
  return variables;
}

export function createGcpAdopt(contexts: GcpContexts): AdoptPart {
  const open = (connection: Parameters<GcpContexts>[0], place: ServicePlace) => {
    const context = contexts(connection);
    return {
      context,
      run: context.deployer(place.account, accountConfigOf(place.accountConfig)).run,
    };
  };

  async function running(
    context: GcpContext,
    run: GcpContext['control']['run'],
    place: ServicePlace,
    service: RunService,
  ): Promise<RunningService> {
    const container =
      ((service.template as { containers?: Container[] }).containers ?? [])[0] ?? {};
    const revision = servingRevision(service);
    const image =
      splitImage(container.image) ??
      (revision
        ? splitImage(await run.revisionDigest(place.account, place.region, revision))
        : null);
    const urls = [...new Set([...(service.uri ? [service.uri] : []), ...service.urls])];
    return {
      name: shortName(service.name) ?? service.name,
      urls,
      revision,
      image,
      variables: await variablesOf(context, place.account, container),
      settings: settingsOfService(service),
    };
  }

  return {
    async listServices(connection, place) {
      const { context, run } = open(connection, place);
      const services = await run.listServices(place.account, place.region);
      const found: RunningService[] = [];
      for (const service of services) found.push(await running(context, run, place, service));
      return found;
    },

    async readService(connection, place, name) {
      const { context, run } = open(connection, place);
      const service = await run.getService(runServiceName(place.account, place.region, name));
      return service ? running(context, run, place, service) : null;
    },

    async runtimePrincipal(target) {
      const context = contexts(target.connection);
      const cluster = target.placement?.cluster;
      if (target.placement && target.placement.runtime !== 'cloud-run' && cluster) {
        return workloadPrincipal(
          context,
          cluster.projectId,
          target.placement.namespace,
          target.application.key,
        );
      }
      const projectId = target.account?.externalId ?? '';
      const account = accountConfigOf(target.account?.config);
      return (
        context.runtimeAccount(projectId, account) ??
        (await defaultRuntimeAccount(context, projectId))
      );
    },
  };
}
