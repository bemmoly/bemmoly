import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clusterSchema, clustersResponseSchema } from '../../../../shared/clusters.ts';
import { applicationRuntimesResponseSchema } from '../../../../shared/runtimes.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';
import { seedShippingFixture, type ShippingFixture } from '../../testing/shipping-fixture.ts';
import { columnsHolding } from '../../testing/variables-fixture.ts';

/*
 * GKE as a runtime, the milestone's proof: checkout-api stays on Cloud Run while cart-api is
 * switched to GKE Autopilot in the same four environments, each of which gets a cluster.
 * Both ship to Prod, both canary, both roll back by themselves, and a switch back to Cloud
 * Run takes effect on the next deploy. cart-api's secret reaches GKE as a version, never a
 * value. The simulated cloud stands in for Google Cloud.
 */

const SECRET_VALUE = 'sentinel-5e0b7d21-gke-test-value';

let harness: PipelinesHarness | undefined;
let http: PipelinesHttp | undefined;
let f: ShippingFixture;
let skip = '';
let cart = '';
let cartRelease: (version: string, config?: Record<string, unknown>) => Promise<string>;

beforeAll(async () => {
  const started = await startPipelinesHarness();
  if (!started.available) {
    skip = started.reason;
    return;
  }
  harness = started.harness;
  http = await startPipelinesHttp(harness);
  const services = harness.services;
  f = await seedShippingFixture(harness, {
    world: harness.world,
    variables: (application, environment) => services.variables.forDeploy(application, environment),
  });
  const { sql, users } = harness;
  const [connection] = await sql<{ id: string }[]>`select id from cloud_connections limit 1`;
  for (const [key, id] of Object.entries(f.environments)) {
    const [account] = await sql<{ id: string }[]>`
      insert into cloud_accounts (connection_id, external_id, name, purpose, status)
      values (${connection?.id ?? ''}, ${`acme-${key.toLowerCase()}`}, ${key}, 'workload', 'ready')
      returning id`;
    await sql`update pipeline_environments set cloud_account_id = ${account?.id ?? ''},
      region = 'us-central1' where id = ${id}`;
  }
  const [app] = await sql<{ id: string }[]>`
    insert into pipeline_applications
      (key, name, domain_id, group_id, owner_team_id, tier, runtime, health)
    select 'cart-api', 'cart-api', domain_id, group_id, owner_team_id, 1, 'container-service',
      'healthy'
    from pipeline_applications where id = ${f.app}
    returning id`;
  cart = app?.id ?? '';
  cartRelease = async (version, config = {}) => {
    const [row] = await sql<{ id: string }[]>`
      insert into pipeline_releases
        (application_id, version, commit_sha, resolved_config, test_summary, created_by)
      values (${cart}, ${version}, 'b2d8f41', ${JSON.stringify(config)}::jsonb,
        '{"total": 4, "passed": 4, "failed": 0, "skipped": 0}'::jsonb, ${users.member})
      returning id`;
    return row?.id ?? '';
  };
});

afterAll(async () => {
  await http?.app.close();
  await harness?.stop();
});

const ready = () => {
  if (!harness || !http) throw new Error('no harness');
  return { h: harness, api: http };
};

async function promotionState(id: string) {
  const [row] = await ready().h.sql<{ state: string; outcome_reason: string | null }[]>`
    select state, outcome_reason from pipeline_promotions where id = ${id}`;
  return row;
}

async function current(application: string, environment: string) {
  const [row] = await ready().h.sql<{ version: string | null; state: string }[]>`
    select version, state from pipeline_current
    where application_id = ${application} and environment_id = ${environment}`;
  return row ?? null;
}

/** Both releases from Dev to Prod, approving Prod; answers the two Prod promotions' end. */
async function shipBoth(checkout: string, cartId: string) {
  const { h } = ready();
  const priya = h.as(h.users.member);
  for (const to of ['dev', 'staging']) {
    for (const release of [checkout, cartId]) {
      const { promotion } = await f.service.requestPromotion(priya, {
        release,
        to,
        mode: 'approval',
      });
      expect(
        await f.runUntil(
          async () => (await promotionState(promotion.id))?.state === 'succeeded',
          30,
        ),
      ).toBe(true);
    }
  }
  const prod: string[] = [];
  for (const release of [checkout, cartId]) {
    const { promotion } = await f.service.requestPromotion(priya, {
      release,
      to: 'prod',
      mode: 'approval',
    });
    await f.service.decide(h.as(f.ravi), promotion.id, {
      decision: 'approved',
      releaseDigest: promotion.release.digest,
    });
    prod.push(promotion.id);
  }
  const done = async () => {
    const states = await Promise.all(prod.map(async (id) => (await promotionState(id))?.state));
    return states.every((state) => state === 'succeeded' || state === 'rolled_back');
  };
  expect(await f.runUntil(done, 180)).toBe(true);
  return Promise.all(prod.map(promotionState));
}

describe('GKE as a runtime beside Cloud Run', () => {
  it('creates a cluster per environment that reports creating, then ready', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const body = { origin: 'created', environmentId: f.environments.dev, mode: 'autopilot' };
    expect((await api.send('POST', '/clusters', h.users.member, body)).statusCode).toBe(403);
    const created = await api.send('POST', '/clusters', h.users.admin, body);
    expect(created.statusCode).toBe(201);
    expect(clusterSchema.parse(created.json())).toMatchObject({
      name: 'bemmoly-dev',
      status: 'creating',
      origin: 'created',
      projectId: 'acme-dev',
      location: 'us-central1',
    });
    expect((await api.send('POST', '/clusters', h.users.admin, body)).statusCode).toBe(409);
    for (const environmentId of [
      f.environments.staging,
      f.environments.prodAsia,
      f.environments.prodUs,
    ]) {
      const made = await api.send('POST', '/clusters', h.users.admin, { ...body, environmentId });
      expect(made.statusCode).toBe(201);
    }
    // The first read finds GKE still creating them; the simulator finishes after that.
    const list = async () =>
      clustersResponseSchema.parse((await api.get('/clusters', h.users.member)).json()).items;
    expect((await list()).map((cluster) => cluster.status)).toEqual(Array(4).fill('creating'));
    const listed = { items: await list() };
    expect(listed.items.map((cluster) => [cluster.name, cluster.status])).toEqual([
      ['bemmoly-dev', 'ready'],
      ['bemmoly-staging', 'ready'],
      ['bemmoly-prod-asia-south1', 'ready'],
      ['bemmoly-prod-us-east1', 'ready'],
    ]);
    expect(listed.items[0]?.releaseChannel).toBe('REGULAR');
    expect(h.world.log).toContain('create cluster acme-dev/us-central1/bemmoly-dev autopilot');
    const [first] = listed.items;
    const removal = await api.send('DELETE', `/clusters/${first?.id}`, h.users.admin);
    expect(removal.statusCode).toBe(400);
    expect(removal.json().message).toMatch(/Pipelines runs bemmoly-dev/);
  });

  it('switches cart-api to GKE Autopilot in every environment without a commit', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const before = applicationRuntimesResponseSchema.parse(
      (await api.get('/applications/cart-api/runtimes', h.users.member)).json(),
    );
    expect(before.items.map((item) => [item.runtime, item.source])).toEqual(
      Array(4).fill(['cloud-run', 'environment']),
    );
    const wrong = await api.send('PUT', '/applications/cart-api/runtimes/dev', h.users.member, {
      runtime: 'gke-standard',
    });
    expect(wrong.json().problem).toMatch(/is GKE Autopilot, not GKE Standard/);
    for (const environment of ['dev', 'staging', 'prod-asia-south1', 'prod-us-east1']) {
      const set = await api.send(
        'PUT',
        `/applications/cart-api/runtimes/${environment}`,
        h.users.member,
        { runtime: 'gke-autopilot' },
      );
      expect(set.statusCode).toBe(200);
      expect(set.json()).toMatchObject({
        runtime: 'gke-autopilot',
        source: 'pipelines',
        problem: null,
      });
    }
    const outsider = await api.send(
      'PUT',
      '/applications/cart-api/runtimes/dev',
      h.users.outsider,
      {
        runtime: 'cloud-run',
      },
    );
    expect(outsider.statusCode).toBe(403);
  });

  it('ships both to Prod, checkout-api on Cloud Run and cart-api on GKE', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h } = ready();
    const outcomes = await shipBoth(await f.release('v1.0.0'), await cartRelease('v1.0.0'));
    expect(outcomes.map((outcome) => outcome?.state)).toEqual(['succeeded', 'succeeded']);
    for (const environment of Object.values(f.environments)) {
      expect(await current(f.app, environment)).toEqual({ version: 'v1.0.0', state: 'idle' });
      expect(await current(cart, environment)).toEqual({ version: 'v1.0.0', state: 'idle' });
    }
    const deploys = h.world.log.filter((line) => line.startsWith('deploy v1.0.0'));
    expect(deploys).toContain('deploy v1.0.0 checkout-api@dev');
    expect(deploys).toContain('deploy v1.0.0 bemmoly-dev/checkout/cart-api@dev');
    expect(deploys).toContain(
      'deploy v1.0.0 bemmoly-prod-us-east1/checkout/cart-api@prod-us-east1',
    );
    expect(deploys.filter((line) => line.includes('/'))).toHaveLength(4);
  });

  it('deploys cart-api on GKE with its secret pinned to a version, never its value', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const put = (name: string, kind: string, value: string) =>
      api.send('PUT', `/applications/cart-api/variables/${name}?environment=dev`, h.users.admin, {
        kind,
        value,
      });
    expect((await put('API_KEY', 'secret', SECRET_VALUE)).statusCode).toBe(200);
    expect((await put('GREETING', 'plain', 'hello')).statusCode).toBe(200);
    const release = await cartRelease('v1.1.0');
    const { promotion } = await f.service.requestPromotion(h.as(h.users.member), {
      release,
      to: 'dev',
      mode: 'approval',
    });
    expect(
      await f.runUntil(async () => (await promotionState(promotion.id))?.state === 'succeeded', 30),
    ).toBe(true);
    const revisions = [
      ...(h.world.targets.get('bemmoly-dev/checkout/cart-api@dev')?.revisions.values() ?? []),
    ];
    const variables = revisions.at(-1)?.variables ?? [];
    expect(variables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'API_KEY', kind: 'secret', version: '1' }),
        { name: 'GREETING', kind: 'plain', value: 'hello' },
      ]),
    );
    expect(JSON.stringify(variables)).not.toContain(SECRET_VALUE);
    expect((await columnsHolding(h, SECRET_VALUE)).found).toEqual([]);
  });

  it('canaries both through to 100% when the new release is healthy', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h } = ready();
    const outcomes = await shipBoth(await f.release('v2.0.0'), await cartRelease('v2.0.0'));
    expect(outcomes.map((outcome) => outcome?.state)).toEqual(['succeeded', 'succeeded']);
    const canary = (key: string) =>
      h.world.log.filter(
        (line) => line.startsWith('shift') && line.endsWith(key) && / 5 /.test(line),
      );
    expect(canary('checkout-api@prod-asia-south1')).toHaveLength(1);
    expect(canary('bemmoly-prod-asia-south1/checkout/cart-api@prod-asia-south1')).toHaveLength(1);
  });

  it('rolls both back by themselves when their canaries fail', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h } = ready();
    const failing = { 'fake.errorRate@prod-asia-south1': 0.3 };
    const outcomes = await shipBoth(
      await f.release('v3.0.0', failing),
      await cartRelease('v3.0.0', failing),
    );
    expect(outcomes.map((outcome) => outcome?.state)).toEqual(['rolled_back', 'rolled_back']);
    expect(outcomes[1]?.outcome_reason).toMatch(/Rolled back in prod-asia-south1/);
    expect(await current(cart, f.environments.prodAsia)).toEqual({
      version: 'v2.0.0',
      state: 'rolled_back',
    });
    expect(await current(f.app, f.environments.prodAsia)).toEqual({
      version: 'v2.0.0',
      state: 'rolled_back',
    });
    const rollbacks = h.world.log.filter((line) => line.startsWith('rollback'));
    expect(
      rollbacks.some((line) =>
        line.endsWith('bemmoly-prod-asia-south1/checkout/cart-api@prod-asia-south1'),
      ),
    ).toBe(true);
    expect(rollbacks.some((line) => line.endsWith(' checkout-api@prod-asia-south1'))).toBe(true);
  });

  it('takes a switch back to Cloud Run on the next deploy', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const back = await api.send('PUT', '/applications/cart-api/runtimes/dev', h.users.member, {
      runtime: null,
    });
    expect(back.json()).toMatchObject({ runtime: 'cloud-run', source: 'environment' });
    const v4 = await cartRelease('v4.0.0');
    const { promotion } = await f.service.requestPromotion(h.as(h.users.member), {
      release: v4,
      to: 'dev',
      mode: 'approval',
    });
    expect(
      await f.runUntil(async () => (await promotionState(promotion.id))?.state === 'succeeded', 30),
    ).toBe(true);
    expect(h.world.log).toContain('deploy v4.0.0 cart-api@dev');
  });
});
