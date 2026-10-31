import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applicationDeploySettingsResponseSchema,
  applicationDeploySettingsSchema,
  environmentRuntimesResponseSchema,
} from '../../../../shared/deploy-settings.ts';
import { variablesResponseSchema } from '../../../../shared/variables.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';
import { seedGkeFixture } from '../../testing/gke-fixture.ts';
import { seedShippingFixture, type ShippingFixture } from '../../testing/shipping-fixture.ts';
import { columnsHolding } from '../../testing/variables-fixture.ts';

/*
 * One definition, Stage on Cloud Run and Prod on GKE Autopilot: the milestone's proof.
 * checkout-api calls cart-api through ${{ apps.cart-api.url }}. Both ship to Staging on Cloud
 * Run at zero instances, then to Prod, where the environment's default is GKE Autopilot: two
 * replicas behind an autoscaler, a disruption budget, the secret as a variable from a synced
 * Secret, the readiness path set in Pipelines, and cart-api's in-cluster address. Then a
 * canary, and a roll back. The simulated cloud stands in for Google Cloud.
 */

const SECRET_VALUE = 'sentinel-7c41e0a9-stage-prod-value';
const PROD = 'prod-asia-south1';

let harness: PipelinesHarness | undefined;
let http: PipelinesHttp | undefined;
let f: ShippingFixture;
let skip = '';
let cartV1 = '';
let checkoutV1 = '';
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
  const gke = await seedGkeFixture(harness, f);
  cartRelease = gke.cartRelease;
});

afterAll(async () => {
  await http?.app.close();
  await harness?.stop();
});

const ready = () => {
  if (!harness || !http) throw new Error('no harness');
  return { h: harness, api: http };
};

const FILE = { deploy: { port: 8080, healthcheck: { path: '/healthz' } } };

async function promotionState(id: string) {
  const [row] = await ready().h.sql<{ state: string; outcome_reason: string | null }[]>`
    select state, outcome_reason from pipeline_promotions where id = ${id}`;
  return row;
}

/** One release to one environment, approved by Ravi where it needs it; answers how it ended. */
async function ship(release: string, to: string) {
  const { h } = ready();
  const { promotion } = await f.service.requestPromotion(h.as(h.users.member), {
    release,
    to,
    mode: 'approval',
  });
  if (to.startsWith('prod')) {
    await f.service.decide(h.as(f.ravi), promotion.id, {
      decision: 'approved',
      releaseDigest: promotion.release.digest,
    });
  }
  const done = async () =>
    ['succeeded', 'rolled_back', 'failed'].includes(
      (await promotionState(promotion.id))?.state ?? '',
    );
  expect(await f.runUntil(done, 120)).toBe(true);
  return promotionState(promotion.id);
}

const latest = (key: string) =>
  [...(ready().h.world.targets.get(key)?.revisions.values() ?? [])].at(-1);

describe('Stage on Cloud Run, Prod on GKE Autopilot, from one definition', () => {
  it('chooses GKE Autopilot as the Prod default and shows who follows it', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    for (const environment of [PROD, 'prod-us-east1']) {
      const patched = await api.send('PATCH', `/environments/${environment}`, h.users.admin, {
        defaultRuntime: 'gke-autopilot',
      });
      expect(patched.statusCode).toBe(200);
    }
    for (const environmentId of [f.environments.prodAsia, f.environments.prodUs]) {
      const made = await api.send('POST', '/clusters', h.users.admin, {
        origin: 'created',
        environmentId,
        mode: 'autopilot',
      });
      expect(made.statusCode).toBe(201);
    }
    await api.get('/clusters', h.users.member);
    await api.get('/clusters', h.users.member);
    const prod = environmentRuntimesResponseSchema.parse(
      (await api.get(`/environments/${PROD}/runtimes`, h.users.member)).json(),
    );
    expect(prod.items).toEqual([
      {
        application: { key: 'cart-api', name: 'cart-api' },
        runtime: 'gke-autopilot',
        source: 'environment',
      },
      {
        application: { key: 'checkout-api', name: 'checkout-api' },
        runtime: 'gke-autopilot',
        source: 'environment',
      },
    ]);
  });

  it('shows each setting with where it came from, per runtime', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    await f.release('v1.0.0', FILE);
    const listed = applicationDeploySettingsResponseSchema.parse(
      (await api.get('/applications/checkout-api/settings', h.users.member)).json(),
    );
    const at = (environment: string, field: string) =>
      listed.items
        .find((item) => item.environment.key === environment)
        ?.effective.find((entry) => entry.field === field);
    expect(at('staging', 'scaling.min')).toMatchObject({ value: 0, source: 'default' });
    expect(at('staging', 'healthcheck.path')).toMatchObject({ value: '/healthz', source: 'file' });
    expect(at(PROD, 'scaling.min')).toMatchObject({ value: 2, source: 'default' });
    expect(at(PROD, 'scaling.concurrency')).toMatchObject({ applies: false });
    expect(listed.items.find((item) => item.environment.key === PROD)).toMatchObject({
      runtime: 'gke-autopilot',
      disruptionBudget: true,
      release: { version: 'v1.0.0' },
    });
  });

  it('keeps Prod settings for the roles that may change Prod', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const body = { healthcheck: { ready: '/ready' } };
    const path = `/applications/checkout-api/settings/${PROD}`;
    expect((await api.send('PUT', path, h.users.member, body)).statusCode).toBe(403);
    expect((await api.send('PUT', path, h.users.outsider, body)).statusCode).toBe(403);
    const bad = await api.send('PUT', path, h.users.admin, { scaling: { min: 5, max: 3 } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().message).toBe(
      `scaling.min (5) is above scaling.max (3) in ${PROD}. Lower min or raise max`,
    );
    const set = await api.send('PUT', path, h.users.admin, body);
    expect(set.statusCode).toBe(200);
    const item = applicationDeploySettingsSchema.parse(set.json());
    expect(item.settings).toEqual(body);
    expect(item.effective.find((entry) => entry.field === 'healthcheck.ready')).toMatchObject({
      value: '/ready',
      source: 'pipelines',
    });
    const stage = await api.send('PUT', '/applications/checkout-api/settings/dev', h.users.member, {
      scaling: { max: 2 },
    });
    expect(stage.statusCode).toBe(200);
    const cleared = await api.send(
      'DELETE',
      '/applications/checkout-api/settings/dev',
      h.users.member,
    );
    expect(cleared.statusCode).toBe(204);
  });

  it('takes a reference to another application and refuses one to nothing', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const put = (name: string, kind: string, value: string, environment?: string) =>
      api.send(
        'PUT',
        `/applications/checkout-api/variables/${name}${environment ? `?environment=${environment}` : ''}`,
        h.users.admin,
        { kind, value },
      );
    const nobody = await put('CART_URL', 'plain', '${{ apps.no-such-api.url }}');
    expect(nobody.statusCode).toBe(400);
    expect(nobody.json().message).toMatch(/^No application is called no-such-api/);
    expect((await put('CART_URL', 'plain', '${{ apps.cart-api.url }}/cart')).statusCode).toBe(200);
    expect((await put('API_KEY', 'secret', SECRET_VALUE, PROD)).statusCode).toBe(200);
    const listed = variablesResponseSchema.parse(
      (await api.get('/applications/checkout-api/variables', h.users.member)).json(),
    );
    const cartUrl = listed.items.find((item) => item.name === 'CART_URL');
    expect(cartUrl?.resolved.find((value) => value.environment === 'staging')).toEqual({
      environment: 'staging',
      value: null,
      problem: 'cart-api is not deployed to staging yet. Deploy cart-api there first',
    });
  });

  it('stops a caller deployed before the application it calls, naming it', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const outcome = await ship(await f.release('v1.0.1', FILE), 'dev');
    expect(outcome?.state).toBe('failed');
    expect(outcome?.outcome_reason).toMatch(/cart-api is not deployed to dev yet/);
  });

  it('runs both on Cloud Run in Staging at zero instances, with the run.app address', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    cartV1 = await cartRelease('v1.0.0', FILE);
    checkoutV1 = await f.release('v1.1.0', FILE);
    for (const to of ['dev', 'staging']) {
      expect((await ship(cartV1, to))?.state).toBe('succeeded');
      expect((await ship(checkoutV1, to))?.state).toBe('succeeded');
    }
    const staging = latest('checkout-api@staging');
    expect(staging?.settings.scaling.min).toBe(0);
    expect(staging?.cluster).toBeNull();
    expect(staging?.variables).toContainEqual({
      name: 'CART_URL',
      kind: 'plain',
      value: 'https://cart-api.staging.fake.test/cart',
    });
    const listed = variablesResponseSchema.parse(
      (await api.get('/applications/checkout-api/variables', h.users.member)).json(),
    );
    expect(
      listed.items
        .find((item) => item.name === 'CART_URL')
        ?.resolved.find((value) => value.environment === 'staging'),
    ).toEqual({
      environment: 'staging',
      value: 'https://cart-api.staging.fake.test/cart',
      problem: null,
    });
  });

  it('runs both on GKE Autopilot in Prod with two replicas, a budget and synced secrets', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h } = ready();
    expect((await ship(cartV1, PROD))?.state).toBe('succeeded');
    expect((await ship(checkoutV1, PROD))?.state).toBe('succeeded');
    const prod = latest(`bemmoly-${PROD}/checkout/checkout-api@${PROD}`);
    expect(prod?.cluster).toEqual({
      autoscaler: { min: 2, max: 10, cpuTarget: 70 },
      disruptionBudget: { maxUnavailable: 1 },
      secrets: expect.stringMatching(/^secret\/checkout-api-/),
      readiness: '/ready',
      liveness: '/healthz',
    });
    expect(prod?.variables).toContainEqual({
      name: 'CART_URL',
      kind: 'plain',
      value: 'http://cart-api.checkout.svc.cluster.local:8080/cart',
    });
    expect(prod?.variables).toContainEqual(
      expect.objectContaining({ name: 'API_KEY', kind: 'secret', version: '1' }),
    );
    expect(JSON.stringify(prod?.variables)).not.toContain(SECRET_VALUE);
    expect((await columnsHolding(h, SECRET_VALUE)).found).toEqual([]);
  });

  it('canaries a new release in Prod, then rolls back one that fails', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h } = ready();
    const key = `bemmoly-${PROD}/checkout/checkout-api@${PROD}`;
    const v2 = await f.release('v2.0.0', FILE);
    for (const to of ['dev', 'staging', PROD])
      expect((await ship(v2, to))?.state).toBe('succeeded');
    expect(
      h.world.log.filter((line) => line.startsWith('shift') && line.endsWith(key)),
    ).toContainEqual(expect.stringMatching(/ 5 /));
    const v3 = await f.release('v3.0.0', { ...FILE, [`fake.errorRate@${PROD}`]: 0.3 });
    for (const to of ['dev', 'staging']) expect((await ship(v3, to))?.state).toBe('succeeded');
    const failed = await ship(v3, PROD);
    expect(failed?.state).toBe('rolled_back');
    expect(h.world.log.some((line) => line.startsWith('rollback') && line.endsWith(key))).toBe(
      true,
    );
    const [now] = await h.sql<{ version: string }[]>`
      select version from pipeline_current
      where application_id = ${f.app} and environment_id = ${f.environments.prodAsia}`;
    expect(now?.version).toBe('v2.0.0');
  });
});
