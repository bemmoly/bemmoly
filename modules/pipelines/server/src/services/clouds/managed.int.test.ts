import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { ApplyStopped } from '../providers/contract.ts';
import { createFakeProvider, createFakeWorld } from '../providers/fake/index.ts';
import { createProviderRegistry } from '../providers/registry.ts';
import { createCloudsService } from './index.ts';

/*
 * Managed mode end to end against real Postgres and the in-memory provider: a connection
 * naming the folder bootstrap.sh made, the Starter plan with its billing headroom, an apply
 * stopped by the billing account and resumed without making anything twice, and a switch to
 * Standard that adds projects, moves environments and deletes nothing.
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

const STOP =
  'Billing account 01A2B3-C4D5E6-F7A8B9 cannot pay for more projects. Ask Google for more, then choose Retry';

/** A fake whose first creation of a production project is refused by the billing account. */
function refusingOnce() {
  const world = createFakeWorld();
  const fake = createFakeProvider(world, 'gcp');
  const zone = fake.landingZone;
  if (!zone) throw new Error('fake has no landing zone');
  let refusals = 1;
  const provider = {
    ...fake,
    landingZone: {
      ...zone,
      async apply(connection: never, resource: never) {
        const { kind, account } = resource as { kind: string; account: string };
        if (kind === 'account' && account.includes('-prod-') && refusals > 0) {
          refusals -= 1;
          throw new ApplyStopped(STOP);
        }
        return zone.apply(connection, resource);
      },
    },
  };
  return { world, provider };
}

async function connectStarter(clouds: ReturnType<typeof createCloudsService>, name: string) {
  const h = need();
  const admin = h.as(h.users.admin);
  const connection = await clouds.connect(admin, {
    provider: 'gcp',
    name,
    layout: 'starter',
    mode: 'managed',
    signIn: 'vm',
    region: 'us-central1',
    folderId: '417302018845',
    folderName: 'Bemmoly',
    billingAccountId: '01A2B3-C4D5E6-F7A8B9',
    controlProject: 'bemmoly-control-583920174411',
  });
  await clouds.check(admin, connection.id);
  return connection;
}

describe('managed mode on a folder', () => {
  it('plans Starter on the named folder, shows billing, applies, resumes and switches', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const h = need();
    const admin = h.as(h.users.admin);
    const { world, provider } = refusingOnce();
    world.billingLinked = 2;
    const sent: string[] = [];
    const clouds = createCloudsService({
      database: h.sql,
      access: h.services.access,
      providers: createProviderRegistry([provider]),
      sendJob: async (_name, _payload, options) => {
        sent.push(options?.idempotencyKey ?? '');
        return 'job';
      },
    });
    const connection = await connectStarter(clouds, 'Acme Starter');
    expect(connection.boundary).toBe('Bemmoly');
    const [row] = await h.sql<{ boundary_ref: string }[]>`
      select boundary_ref from cloud_connections where id = ${connection.id}`;
    expect(row?.boundary_ref).toBe('folders/417302018845');

    // The plan: exactly the projects, registry and identities, and the billing headroom.
    const plan = await clouds.plan(admin, connection.id, {});
    expect(plan.blockers).toEqual([]);
    expect(plan.layout).toBe('starter');
    expect(plan.root.children.map((child) => child.note)).toEqual([
      'Bemmoly platform',
      'Non-production',
      'Production',
    ]);
    const platform = plan.root.children[0];
    expect(platform?.children.map((child) => child.name)).toEqual([
      'Services',
      'Build identity',
      'Registry',
      'Logs',
    ]);
    expect(plan.billing).toMatchObject({ linked: 2, adding: 2, limit: 5, recorded: false });
    expect(plan.warnings).toEqual([]);
    expect(plan.status).toBe('planned');

    // Apply stops on the billing account, says why, and makes nothing after it.
    await clouds.apply(admin, connection.id, { planId: plan.planId, specHash: plan.specHash });
    await expect(clouds.runApply(plan.planId)).rejects.toThrow(STOP);
    const stopped = await clouds.planById(admin, connection.id, plan.planId);
    expect(stopped).toMatchObject({ status: 'failed', lastError: STOP });
    const waiting = await h.sql<{ n: number }[]>`
      select count(*)::int as n from cloud_resources r join cloud_accounts a on a.id = r.account_id
      where a.connection_id = ${connection.id} and r.last_error like 'Stopped:%'`;
    expect(waiting[0]?.n).toBeGreaterThan(0);

    // Retry applies the same plan again, under a new job key, and finishes where it stopped.
    await clouds.apply(admin, connection.id, { planId: plan.planId, specHash: plan.specHash });
    expect(sent).toEqual([
      `pipelines.landing-zone-apply:${plan.planId}:${plan.specHash}:1`,
      `pipelines.landing-zone-apply:${plan.planId}:${plan.specHash}:2`,
    ]);
    const retried = await clouds.runApply(plan.planId);
    expect(retried.failed).toEqual([]);
    expect(retried.skipped).toBeGreaterThan(0);
    const applies = world.log.filter((line) => line.startsWith('apply '));
    expect(new Set(applies).size).toBe(applies.length);
    expect((await clouds.planById(admin, connection.id, plan.planId)).status).toBe('applied');

    // Environments point at their tier's project, and runners push to the shared registry.
    const accounts = (await clouds.accounts(admin, connection.id)).items;
    expect(accounts.every((account) => account.status === 'ready')).toBe(true);
    const mapped = await h.sql<{ key: string; account: string }[]>`
      select e.key, a.external_id as account from pipeline_environments e
      join cloud_accounts a on a.id = e.cloud_account_id
      where a.connection_id = ${connection.id} order by e.key`;
    expect(mapped.map((entry) => entry.account.split('-')[1])).toEqual([
      'nonprod',
      'prod',
      'nonprod',
    ]);
    const [saved] = (await clouds.list(admin)).items.filter((item) => item.id === connection.id);
    expect(saved?.registry).toBe('fake.registry/bemmoly-control-583920174411/apps');

    // Switching to Standard adds projects and moves environments, and deletes nothing.
    const standard = await clouds.plan(admin, connection.id, { layout: 'per-environment' });
    const kept = standard.root.children.filter((child) => child.status === 'kept');
    expect(kept.map((child) => child.note)).toEqual(['Non-production', 'Production']);
    expect(standard.billing).toMatchObject({ adding: 4 });
    expect(standard.warnings).toEqual([
      expect.stringContaining('this plan adds 4'),
      expect.stringMatching(/^Dev moves from acme-nonprod-/),
      expect.stringMatching(/^Staging moves from acme-nonprod-/),
      expect.stringMatching(/^Prod · asia-south1 moves from acme-prod-/),
      expect.stringContaining('never deletes a project'),
    ]);
    await clouds.apply(admin, connection.id, {
      planId: standard.planId,
      specHash: standard.specHash,
    });
    await clouds.runApply(standard.planId);
    const after = (await clouds.accounts(admin, connection.id)).items;
    expect(after.map((account) => account.name)).toEqual(
      expect.arrayContaining(['Non-production', 'Production', 'Bemmoly CI', 'Dev']),
    );
    const [dev] = await h.sql<{ account: string }[]>`
      select a.external_id as account from pipeline_environments e
      join cloud_accounts a on a.id = e.cloud_account_id where e.key = 'dev'`;
    expect(dev?.account).toMatch(/^acme-dev-/);
  });

  it('warns when the billing account would pass its usual limit, and blocks above a recorded one', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const h = need();
    const admin = h.as(h.users.admin);
    h.world.billingLinked = 4;
    const connection = await connectStarter(h.services.clouds, 'Busy Billing');
    const plan = await h.services.clouds.plan(admin, connection.id, {});
    expect(plan.blockers).toEqual([]);
    expect(plan.warnings).toEqual([
      expect.stringContaining('pays for 4 projects and this plan adds 2'),
    ]);
    expect(plan.warnings[0]).toContain('Google does not publish it');
    h.world.billingLimit = { limit: 5, recorded: true };
    const recorded = await h.services.clouds.plan(admin, connection.id, {});
    expect(recorded.warnings[0]).toContain('the 5 recorded on this connection');
    h.world.billingLinked = 0;
    h.world.billingLimit = { limit: 5, recorded: false };
  });
});
