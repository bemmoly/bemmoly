import { createHash } from 'node:crypto';
import type { Provider } from '../../../../../shared/common.ts';
import type { CloudProvider, DesiredResource } from '../contract.ts';
import { createFakeTargets, type FakeTargetsWorld } from './targets.ts';

/*
 * The fake provider: every part, in memory and deterministic. Tests use it to drive the
 * promotion engine and the landing zone reconciler without a cloud, and the conformance
 * kit runs against it first so the kit itself is known to be right.
 */

export interface FakeWorld extends FakeTargetsWorld {
  boundaries: Set<string>;
  accounts: Map<string, { name: string; labels: Readonly<Record<string, string>> }>;
  resources: Map<string, Record<string, unknown>>;
  /** Secret versions by "account/name": only a hash, as a real store's audit would show. */
  secrets: Map<string, string[]>;
  grants: Set<string>;
  /** How many more accounts the billing account may link; quota checks read it. */
  accountQuota: number;
  /** Set to make the next connection check fail with these problems. */
  connectionProblems: string[];
  /** Projects an attach check finds problems in; any other project attaches cleanly. */
  accountProblems: Map<string, string[]>;
}

export function createFakeWorld(): FakeWorld {
  return {
    targets: new Map(),
    log: [],
    boundaries: new Set(),
    accounts: new Map(),
    resources: new Map(),
    secrets: new Map(),
    grants: new Set(),
    accountQuota: 100,
    connectionProblems: [],
    accountProblems: new Map(),
  };
}

export const resourceKey = (resource: Pick<DesiredResource, 'kind' | 'name' | 'account'>) =>
  `${resource.kind}/${resource.name}@${resource.account}`;

/** `id` is the provider it stands in for: tests and the simulator swap it in for a cloud. */
export function createFakeProvider(
  world: FakeWorld = createFakeWorld(),
  id: Provider = 'gcp',
): CloudProvider & { world: FakeWorld } {
  const { targets, metrics } = createFakeTargets(world);
  return {
    id,
    name: 'Simulated',
    description: 'In-memory provider for tests and the demo simulator',
    comingSoon: [],
    world,
    targets,
    metrics,
    connection: {
      async verify(connection) {
        const problems = [...world.connectionProblems];
        return {
          ok: problems.length === 0,
          principal: problems.length === 0 ? `fake-control@${connection.name}` : null,
          problems,
        };
      },
      async verifyAccount(_connection, account) {
        const problems = world.accountProblems.get(account.externalId) ?? [];
        return { ok: problems.length === 0, name: `Simulated ${account.externalId}`, problems };
      },
    },
    org: {
      async ensureBoundary(_connection, name) {
        world.boundaries.add(name);
        return { ref: `folders/${name}` };
      },
      async listAccounts() {
        return [...world.accounts].map(([externalId, account]) => ({
          externalId,
          name: account.name,
          state: 'ready' as const,
        }));
      },
      async createAccount(_connection, input) {
        if (!world.accounts.has(input.externalId)) {
          if (world.accountQuota <= 0) throw new Error('No account quota left');
          world.accountQuota -= 1;
          world.accounts.set(input.externalId, { name: input.name, labels: input.labels });
        }
        return { externalId: input.externalId };
      },
      async checkQuota(_connection, count) {
        return count > world.accountQuota
          ? [
              `${count} new projects are needed and the billing account can link ${world.accountQuota}`,
            ]
          : [];
      },
    },
    landingZone: {
      async read(_connection, resource) {
        return world.resources.get(resourceKey(resource)) ?? null;
      },
      async apply(_connection, resource) {
        const observed = { ...resource.spec };
        world.resources.set(resourceKey(resource), observed);
        world.log.push(`apply ${resourceKey(resource)}`);
        return observed;
      },
      diff(resource, observed) {
        return Object.entries(resource.spec)
          .filter(([key, value]) => JSON.stringify(observed[key]) !== JSON.stringify(value))
          .map(([key]) => `${key} differs`);
      },
    },
    registry: {
      async ensureRepository(_connection, input) {
        return { repository: `fake.registry/${input.account}/${input.name}` };
      },
      async grantPull(_connection, input) {
        world.grants.add(`pull ${input.repository} ${input.principal}`);
      },
      async hasDigest() {
        return true;
      },
    },
    secrets: {
      async writeVersion(_connection, input) {
        const key = `${input.account}/${input.name}`;
        const versions = world.secrets.get(key) ?? [];
        versions.push(createHash('sha256').update(input.value).digest('hex'));
        world.secrets.set(key, versions);
        return { version: String(versions.length) };
      },
      async grantAccess(_connection, input) {
        world.grants.add(`secret ${input.account}/${input.name} ${input.principal}`);
      },
    },
    runners: {
      async ensurePool(_connection, input) {
        return { ref: `pools/${input.account}/${input.name}` };
      },
      async scale() {},
    },
    access: {
      async grant(_connection, input) {
        world.grants.add(`${input.role} ${input.account} ${input.principal}`);
      },
      async revoke(_connection, input) {
        world.grants.delete(`${input.role} ${input.account} ${input.principal}`);
      },
    },
    cost: {
      async spend() {
        return { amount: 0, currency: 'USD' };
      },
    },
  };
}
