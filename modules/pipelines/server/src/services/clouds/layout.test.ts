import { describe, expect, it } from 'vitest';
import type { Layout } from '../../../../shared/clouds.ts';
import { landingZoneNodeSchema } from '../../../../shared/landing-zones.ts';
import { canonicalJson, specHash } from './hash.ts';
import { buildZone, resourceHash, type ZoneInput } from './layout.ts';
import { accountIdOf, prefixOf } from './naming.ts';
import { inDependencyOrder, keyOf } from './order.ts';
import { previewTree, type RecordedResource } from './tree.ts';

/* Declaring a landing zone: layouts, names, hashes, order and the preview tree. */

const input = (layout: Layout, config: Record<string, unknown> = {}): ZoneInput => ({
  connection: {
    id: '0199f0aa-0000-7000-8000-00000000c10d',
    name: 'Acme Google Cloud',
    layout,
    config: { region: 'asia-south1', ...config },
  },
  environments: [
    { id: 'e1', key: 'dev', name: 'Dev', class: 'dev' },
    { id: 'e2', key: 'staging', name: 'Staging', class: 'staging' },
    { id: 'e3', key: 'prod-asia-south1', name: 'Prod · asia-south1', class: 'prod' },
  ],
  domains: [
    { id: 'd1', key: 'commerce', name: 'Commerce' },
    { id: 'd2', key: 'data', name: 'Data' },
  ],
  groups: [
    { id: 'g1', key: 'checkout', name: 'Checkout', domainId: 'd1' },
    { id: 'g2', key: 'pricing', name: 'Pricing', domainId: 'd1' },
    { id: 'g3', key: 'lake', name: 'Lake', domainId: 'd2' },
  ],
});

const workloads = (layout: Layout) =>
  buildZone(input(layout)).accounts.filter((account) => account.purpose === 'workload');

describe('landing zone layouts', () => {
  it('declares one account per environment', () => {
    const accounts = workloads('per-environment');
    expect(accounts.map((account) => account.name)).toEqual([
      'Dev',
      'Staging',
      'Prod · asia-south1',
    ]);
    expect(accounts.every((account) => account.folder === null)).toBe(true);
  });

  it('declares one account per domain and environment, foldered by domain', () => {
    const accounts = workloads('per-domain-environment');
    expect(accounts).toHaveLength(6);
    expect(accounts[0]).toMatchObject({
      name: 'Commerce · Dev',
      folder: 'Commerce',
      domain: { key: 'commerce' },
    });
    expect(new Set(accounts.map((account) => account.folder))).toEqual(
      new Set(['Commerce', 'Data']),
    );
  });

  it('declares one account per group and environment', () => {
    const accounts = workloads('per-group-environment');
    expect(accounts).toHaveLength(9);
    expect(accounts.map((account) => account.name)).toContain('Lake · Staging');
  });

  it('always adds the CI and control accounts, the registry living in CI', () => {
    const zone = buildZone(
      input('per-environment', { controlProject: 'bemmoly-control-583920174411' }),
    );
    expect(zone.accounts.slice(0, 2).map((account) => account.purpose)).toEqual(['control', 'ci']);
    expect(zone.accounts[0]?.externalId).toBe('bemmoly-control-583920174411');
    const ci = zone.accounts[1]?.externalId ?? '';
    const pulls = zone.resources.filter(
      (resource) => resource.kind === 'registry_access' && resource.account !== ci,
    );
    expect(pulls).toHaveLength(3);
    expect(pulls.every((pull) => pull.dependsOn.includes(`registry_access/apps@${ci}`))).toBe(true);
  });

  it('adds budgets only for classes that have one', () => {
    const zone = buildZone(input('per-environment', { monthlyBudgets: { prod: 1500 } }));
    const budgets = zone.resources.filter((resource) => resource.kind === 'budget');
    expect(budgets).toHaveLength(1);
    expect(budgets[0]?.spec).toEqual({ monthly: 1500, currency: 'USD', alerts: [0.5, 0.9, 1] });
  });
});

describe('the Starter layout', () => {
  const starter = buildZone(input('starter', { controlProject: 'bemmoly-control-583920174411' }));

  it('declares the platform project and one each for non-production and production', () => {
    expect(starter.accounts.map((account) => [account.name, account.purpose])).toEqual([
      ['Bemmoly platform', 'control'],
      ['Non-production', 'workload'],
      ['Production', 'workload'],
    ]);
    const [, nonprod, prod] = starter.accounts;
    expect(nonprod?.externalId).toMatch(/^acme-nonprod-[0-9a-f]{4}$/);
    expect(nonprod?.environments?.map((environment) => environment.key)).toEqual([
      'dev',
      'staging',
    ]);
    expect(prod?.environments?.map((environment) => environment.key)).toEqual(['prod-asia-south1']);
  });

  it('adopts the bootstrap project and keeps the shared registry and builder there', () => {
    const platform = 'bemmoly-control-583920174411';
    const own = starter.resources.filter((resource) => resource.account === platform);
    expect(own.map((resource) => `${resource.kind}/${resource.name}`)).toEqual([
      `account/${platform}`,
      'service_api/apis',
      'runtime_identity/builder',
      'registry_access/apps',
      'logging/logs',
    ]);
    expect(own[0]?.spec).toMatchObject({ adopt: true });
    const pulls = starter.resources.filter(
      (resource) => resource.kind === 'registry_access' && resource.account !== platform,
    );
    expect(pulls.map((pull) => pull.spec['registryAccount'])).toEqual([platform, platform]);
  });

  it('gives each project its own deployer and runtime identity', () => {
    for (const account of starter.accounts.slice(1)) {
      const kinds = starter.resources
        .filter((resource) => resource.account === account.externalId)
        .map((resource) => resource.kind);
      expect(kinds).toEqual(expect.arrayContaining(['deployer_identity', 'runtime_identity']));
    }
  });

  it('leaves out a tier with no environments', () => {
    const small = input('starter');
    small.environments = small.environments.filter((environment) => environment.class === 'dev');
    expect(buildZone(small).accounts.map((account) => account.name)).toEqual([
      'Bemmoly platform',
      'Non-production',
    ]);
  });
});

describe('account names', () => {
  it('fit Google’s 30-character project ids and stay distinct when cut', () => {
    const a = accountIdOf('acme', ['payments-platform', 'prod-asia-south1'], '3f2a');
    const b = accountIdOf('acme', ['payments-platform', 'prod-europe-west1'], '3f2a');
    for (const id of [a, b, accountIdOf('acme', ['dev'], '3f2a')]) {
      expect(id).toMatch(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/);
    }
    expect(a).not.toBe(b);
  });

  it('take the first word of the connection as the prefix unless one is set', () => {
    expect(prefixOf('Acme Google Cloud', undefined)).toBe('acme');
    expect(prefixOf('42 Labs', undefined)).toBe('b42');
    expect(prefixOf('Acme', 'acmecorp')).toBe('acmecorp');
  });
});

describe('spec hashes', () => {
  it('ignore key order and change with any value', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: null } })).toBe(
      '{"a":{"c":null,"d":[2,1]},"b":1}',
    );
    expect(specHash({ a: 1, b: 2 })).toBe(specHash({ b: 2, a: 1 }));
    expect(specHash({ a: 1 })).not.toBe(specHash({ a: 2 }));
  });

  it('are stable for the same zone and change when an environment is added', () => {
    const first = buildZone(input('per-domain-environment'));
    expect(buildZone(input('per-domain-environment')).hash).toBe(first.hash);
    const more = input('per-domain-environment');
    more.environments = [
      ...more.environments,
      { id: 'e4', key: 'prod-us', name: 'Prod · US', class: 'prod' },
    ];
    expect(buildZone(more).hash).not.toBe(first.hash);
  });
});

describe('dependency order', () => {
  it('puts every resource after what it depends on', () => {
    const zone = buildZone(input('per-domain-environment'));
    const ordered = inDependencyOrder([...zone.resources].reverse());
    const position = new Map(ordered.map((resource, index) => [keyOf(resource), index]));
    for (const resource of ordered) {
      for (const dependency of resource.dependsOn) {
        expect(position.get(dependency)).toBeLessThan(position.get(keyOf(resource)) ?? -1);
      }
    }
  });
});

describe('the preview tree', () => {
  it('marks everything to create on a first plan and matches the shared contract', () => {
    const zone = buildZone(input('per-domain-environment'));
    const { root, counts } = previewTree(zone, false, new Map());
    expect(landingZoneNodeSchema.parse(root)).toBeTruthy();
    expect(root).toMatchObject({ kind: 'folder', name: 'Bemmoly', status: 'create' });
    expect(root.children.map((child) => child.name).slice(2)).toEqual(['Commerce', 'Data']);
    expect(counts).toEqual({ folders: 3, accounts: 8, resources: zone.resources.length - 8 });
  });

  it('shows what exists, what changes and what drifted', () => {
    const zone = buildZone(input('per-environment'));
    const recorded = new Map<string, RecordedResource>(
      zone.resources.map((resource) => [
        keyOf(resource),
        { status: 'ready', specHash: resourceHash(resource), everReconciled: true },
      ]),
    );
    expect(previewTree(zone, true, recorded).root.status).toBe('exists');
    const logs = zone.resources.find(
      (resource) => resource.kind === 'logging' && resource.account.includes('-dev-'),
    );
    recorded.set(keyOf(logs!), {
      status: 'drifted',
      specHash: resourceHash(logs!),
      everReconciled: true,
    });
    const changed = buildZone(input('per-environment', { monthlyBudgets: { prod: 900 } }));
    const tree = previewTree(changed, true, recorded).root;
    expect(tree.status).toBe('drifted');
    const prod = tree.children.find((child) => child.note === 'Prod · asia-south1');
    expect(prod?.status).toBe('update');
    expect(prod?.children.find((child) => child.name === 'Budget')?.status).toBe('create');
  });
});
