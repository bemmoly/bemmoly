import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { createFakeProvider, createFakeWorld } from '../providers/fake/index.ts';
import { createProviderRegistry } from '../providers/registry.ts';
import { createCloudsService } from './index.ts';

/*
 * The landing zone loop against real Postgres and the in-memory provider: plan, apply in
 * dependency order, skip what is already applied, retry what failed, and find drift.
 */

let harness: PipelinesHarness | undefined;
let skip = '';

beforeAll(async () => {
  const started = await startPipelinesHarness();
  if (!started.available) {
    skip = started.reason;
    return;
  }
  harness = started.harness;
  await seedCatalogFixture(harness.sql, harness.users.member);
});

afterAll(async () => {
  await harness?.stop();
});

const need = () => {
  if (!harness) throw new Error('no harness');
  return harness;
};

async function connect(name: string, layout: 'per-environment' | 'per-domain-environment') {
  const h = need();
  const admin = h.as(h.users.admin);
  const connection = await h.services.clouds.connect(admin, {
    provider: 'gcp',
    name,
    layout,
    organizationId: '583920174411',
    billingAccountId: '01A2B3-C4D5E6-F7A8B9',
    folderName: 'Bemmoly',
  });
  await h.services.clouds.check(admin, connection.id);
  return connection.id;
}

describe('the landing zone reconciler', () => {
  it('applies a per-domain plan in dependency order and maps environments', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const h = need();
    const admin = h.as(h.users.admin);
    const id = await connect('Acme Google Cloud', 'per-domain-environment');
    const plan = await h.services.clouds.plan(admin, id, {});
    expect(plan.blockers).toEqual([]);
    expect(plan.counts).toMatchObject({ folders: 3, accounts: 8 });
    expect(plan.root.status).toBe('create');

    await h.services.clouds.apply(admin, id, { planId: plan.planId, specHash: plan.specHash });
    expect(h.jobs.at(-1)).toMatchObject({
      name: 'pipelines.landing-zone-apply',
      payload: { planId: plan.planId },
      idempotencyKey: `pipelines.landing-zone-apply:${plan.planId}:${plan.specHash}:1`,
    });
    const outcome = await h.services.clouds.runApply(plan.planId);
    expect(outcome.failed).toEqual([]);
    expect(outcome.applied).toBe(plan.counts.accounts + plan.counts.resources);

    const applyOrder = h.world.log.filter((line) => line.startsWith('apply '));
    const position = (key: string) => applyOrder.indexOf(`apply ${key}`);
    const accounts = await h.services.clouds.accounts(admin, id);
    const commerceProd = accounts.items.find(
      (account) => account.domain?.key === 'commerce' && account.environmentClass === 'prod',
    );
    expect(commerceProd?.status).toBe('ready');
    const project = commerceProd?.externalId ?? '';
    expect(position(`service_api/apis@${project}`)).toBeGreaterThan(
      position(`account/${project}@${project}`),
    );
    expect(position(`secret_store/secrets@${project}`)).toBeGreaterThan(
      position(`runtime_identity/runtime@${project}`),
    );
    expect(h.world.boundaries.has('Bemmoly')).toBe(true);

    const mapped = await h.sql<{ count: number }[]>`
      select count(*)::int as count from pipeline_environment_accounts`;
    expect(mapped[0]?.count).toBe(6);
    const resources = await h.services.clouds.resources(admin, id);
    expect(resources.items.every((resource) => resource.status === 'ready')).toBe(true);

    const again = await h.services.clouds.plan(admin, id, {});
    expect(again.specHash).toBe(plan.specHash);
    expect(again.root.status).toBe('exists');
  });

  it('skips what is already applied when the same zone is applied again', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const h = need();
    const admin = h.as(h.users.admin);
    const [row] = await h.sql<
      { id: string }[]
    >`select id from cloud_connections where name = 'Acme Google Cloud'`;
    const plan = await h.services.clouds.plan(admin, row?.id ?? '', {});
    await h.services.clouds.apply(admin, row?.id ?? '', {
      planId: plan.planId,
      specHash: plan.specHash,
    });
    const before = h.world.log.length;
    const outcome = await h.services.clouds.runApply(plan.planId);
    expect(outcome).toMatchObject({ applied: 0, failed: [] });
    expect(outcome.skipped).toBe(plan.counts.accounts + plan.counts.resources);
    expect(h.world.log.length).toBe(before);
  });

  it('marks changed resources as drifted and shows them in the next preview', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const h = need();
    const admin = h.as(h.users.admin);
    const [row] = await h.sql<
      { id: string }[]
    >`select id from cloud_connections where name = 'Acme Google Cloud'`;
    const key = [...h.world.resources.keys()].find((entry) => entry.startsWith('logging/logs@'));
    h.world.resources.set(key ?? '', { retentionDays: 1 });
    const scan = await h.services.clouds.scanDrift();
    expect(scan.drifted).toBe(1);
    const resources = await h.services.clouds.resources(admin, row?.id ?? '');
    const drifted = resources.items.filter((resource) => resource.status === 'drifted');
    expect(drifted).toHaveLength(1);
    expect(drifted[0]?.lastError).toContain('retentionDays');
    const accounts = await h.services.clouds.accounts(admin, row?.id ?? '');
    expect(accounts.items.filter((account) => account.status === 'drifted')).toHaveLength(1);
    expect((await h.services.clouds.plan(admin, row?.id ?? '', {})).root.status).toBe('drifted');
  });

  it('stops only what depends on a failure, and a retry finishes the rest', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const h = need();
    const world = createFakeWorld();
    const fake = createFakeProvider(world, 'gcp');
    const zone = fake.landingZone;
    if (!zone) throw new Error('fake has no landing zone');
    let failures = 1;
    const flaky = {
      ...fake,
      landingZone: {
        ...zone,
        async apply(connection: never, resource: never) {
          const { kind } = resource as { kind: string };
          if (kind === 'service_api' && failures > 0) {
            failures -= 1;
            throw new Error('Service Usage answered 503');
          }
          return zone.apply(connection, resource);
        },
      },
    };
    const clouds = createCloudsService({
      database: h.sql,
      access: h.services.access,
      providers: createProviderRegistry([flaky]),
      sendJob: async () => 'job',
    });
    const admin = h.as(h.users.admin);
    const id = await connect('Retry Cloud', 'per-environment');
    await h.sql`update cloud_connections set status = 'connected' where id = ${id}`;
    const plan = await clouds.plan(admin, id, { environments: ['dev'] });
    await clouds.apply(admin, id, { planId: plan.planId, specHash: plan.specHash });
    await expect(clouds.runApply(plan.planId)).rejects.toThrow(/1 resources failed/);
    const statuses = await h.sql<{ status: string; n: number }[]>`
      select r.status, count(*)::int as n from cloud_resources r
      join cloud_accounts a on a.id = r.account_id where a.connection_id = ${id}
      group by r.status order by r.status`;
    expect(statuses.find((entry) => entry.status === 'failed')?.n).toBe(1);
    expect(statuses.find((entry) => entry.status === 'pending')?.n).toBeGreaterThan(0);

    const retried = await clouds.runApply(plan.planId);
    expect(retried.failed).toEqual([]);
    expect(retried.skipped).toBeGreaterThan(0);
    const [state] = await h.sql<{ status: string }[]>`
      select status from cloud_landing_zone_plans where id = ${plan.planId}`;
    expect(state?.status).toBe('applied');
  });

  it('blocks a plan the billing quota cannot hold', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const h = need();
    h.world.accountQuota = 2;
    const id = await connect('Small Billing', 'per-domain-environment');
    const plan = await h.services.clouds.plan(h.as(h.users.admin), id, {});
    expect(plan.blockers).toEqual([expect.stringContaining('7 new projects')]);
    await expect(
      h.services.clouds.apply(h.as(h.users.admin), id, {
        planId: plan.planId,
        specHash: plan.specHash,
      }),
    ).rejects.toThrow(/7 new projects/);
    h.world.accountQuota = 100;
  });
});
