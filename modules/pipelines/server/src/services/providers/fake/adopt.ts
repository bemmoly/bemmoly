import { createHash } from 'node:crypto';
import type { AdoptPart, RunningService, ServicePlace } from '../contract.ts';

/*
 * Services deployed by hand in the simulated cloud, for adopting. Tests put them there with
 * handDeploy. The demo simulator has no test to do that, so a project whose id ends in
 * "-by-hand" holds three services and one stray from the first time it is listed: a service
 * reading another's address, a secret, and settings as a console would leave them.
 */

export interface FakeAdoptWorld {
  /** Hand-deployed services by "account/name". */
  running: Map<string, RunningService>;
  secrets: Map<string, string[]>;
  secretValues: Map<string, string[]>;
}

export const runningKey = (account: string, name: string) => `${account}/${name}`;

/** Where a hand-deployed service answers in the simulated cloud. */
export const handDeployedUrl = (account: string, name: string) =>
  `https://${name}-by-hand.${account}.fake.test`;

/** Puts a service in the simulated cloud as if someone deployed it from the console. */
export function handDeploy(
  world: FakeAdoptWorld,
  account: string,
  service: Omit<RunningService, 'urls' | 'revision' | 'image'> & {
    revision?: string;
    image?: RunningService['image'];
  },
): RunningService {
  const digest = `sha256:${createHash('sha256').update(`${account}/${service.name}`).digest('hex')}`;
  const made: RunningService = {
    ...service,
    urls: [handDeployedUrl(account, service.name)],
    revision: service.revision ?? `${service.name}-00007-hnd`,
    image: service.image ?? { repository: `fake.registry/${account}/apps/${service.name}`, digest },
  };
  world.running.set(runningKey(account, service.name), made);
  return made;
}

/** Writes a secret version as someone did by hand, and answers its number. */
export function handWriteSecret(
  world: FakeAdoptWorld,
  account: string,
  name: string,
  value: string,
): string {
  const key = `${account}/${name}`;
  world.secrets.set(key, [
    ...(world.secrets.get(key) ?? []),
    createHash('sha256').update(value).digest('hex'),
  ]);
  world.secretValues.set(key, [...(world.secretValues.get(key) ?? []), value]);
  return String(world.secrets.get(key)?.length ?? 1);
}

function seedDemo(world: FakeAdoptWorld, account: string) {
  const version = handWriteSecret(world, account, 'pricing-db-password', `simulated-${account}`);
  handDeploy(world, account, {
    name: 'pricing-svc',
    variables: [
      { name: 'LOG_LEVEL', kind: 'plain', value: 'info' },
      { name: 'DB_PASSWORD', kind: 'secret', account, secret: 'pricing-db-password', version },
    ],
    settings: { 'scaling.min': 0, 'scaling.max': 4, 'scaling.concurrency': 80, port: 8080 },
  });
  handDeploy(world, account, {
    name: 'promo-engine',
    variables: [
      {
        name: 'PRICING_URL',
        kind: 'plain',
        value: `${handDeployedUrl(account, 'pricing-svc')}/v1`,
      },
    ],
    settings: { 'scaling.min': 0, 'resources.memory': '512Mi', 'healthcheck.path': '/healthz' },
  });
  handDeploy(world, account, {
    name: 'search-api',
    variables: [{ name: 'INDEX', kind: 'plain', value: 'products' }],
    settings: { 'scaling.min': 1, port: 8080 },
  });
  handDeploy(world, account, { name: 'nightly-report', variables: [], settings: {} });
}

export function createFakeAdopt(world: FakeAdoptWorld): AdoptPart {
  const inProject = (place: ServicePlace) => {
    const prefix = `${place.account}/`;
    const found = [...world.running].filter(([key]) => key.startsWith(prefix));
    if (found.length === 0 && place.account.endsWith('-by-hand')) {
      seedDemo(world, place.account);
      return [...world.running].filter(([key]) => key.startsWith(prefix));
    }
    return found;
  };
  return {
    async listServices(_connection, place) {
      return inProject(place)
        .map(([, service]) => service)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async readService(_connection, place, name) {
      inProject(place);
      return world.running.get(runningKey(place.account, name)) ?? null;
    },
    async runtimePrincipal(target) {
      const cluster = target.placement?.cluster;
      if (target.placement && target.placement.runtime !== 'cloud-run' && cluster) {
        return `fake-pods@${cluster.name}/${target.placement.namespace}/${target.application.key}`;
      }
      return `fake-runtime@${target.account?.externalId ?? 'nowhere'}`;
    },
  };
}
