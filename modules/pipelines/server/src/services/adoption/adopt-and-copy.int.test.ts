import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adoptionPlanSchema, adoptResultSchema } from '../../../../shared/adoption.ts';
import { copyPlanSchema, copyResultSchema, type CopyItem } from '../../../../shared/config-copy.ts';
import { variablesResponseSchema } from '../../../../shared/variables.ts';
import {
  seedAdoptFixture,
  shipTo,
  STAGE_PROJECT,
  type AdoptFixture,
} from '../../testing/adopt-fixture.ts';
import { seedGkeFixture, type GkeFixture } from '../../testing/gke-fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';
import { seedShippingFixture, type ShippingFixture } from '../../testing/shipping-fixture.ts';
import { columnsHolding } from '../../testing/variables-fixture.ts';

/*
 * Staging runs three Cloud Run services deployed by hand; Prod does not exist yet and will
 * run on GKE Autopilot. Pipelines refuses to deploy over a service it did not adopt, adopts
 * all three as they run, rolls Staging forward from release zero, then copies the
 * configuration to Prod: one secret store to store, the others left needing a value, and
 * Staging's zero instances left behind for Prod's two. Prod's pods then run with the
 * in-cluster address, the synced secret and the autoscaler, and no secret value is anywhere
 * in the database. The simulated cloud stands in for Google Cloud.
 */

const PROD = 'prod-asia-south1';
const FILE = { deploy: { port: 8080, healthcheck: { path: '/healthz' } } };

let harness: PipelinesHarness | undefined;
let http: PipelinesHttp | undefined;
let f: ShippingFixture;
let gke: GkeFixture;
let a: AdoptFixture;
let skip = '';
const releases: Record<string, string> = {};

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
  gke = await seedGkeFixture(harness, f);
  a = await seedAdoptFixture(harness, gke);
  releases['checkout-api'] = await f.release('v1.0.0', FILE);
  releases['cart-api'] = await gke.cartRelease('v1.0.0', FILE);
  releases['search-api'] = await a.searchRelease('v1.0.0', FILE);
});

afterAll(async () => {
  await http?.app.close();
  await harness?.stop();
});

const ready = () => {
  if (!harness || !http) throw new Error('no harness');
  return { h: harness, api: http };
};

const ship = (release: string, to: string) => shipTo(ready().h, f, release, to);

const latest = (key: string) =>
  [...(ready().h.world.targets.get(key)?.revisions.values() ?? [])].at(-1);

describe('adopt Staging as it runs, then copy it to a fresh Prod on GKE Autopilot', () => {
  it('refuses to deploy over a service it did not adopt', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    expect((await ship(releases['cart-api'] ?? '', 'dev'))?.state).toBe('succeeded');
    const refused = await ship(releases['cart-api'] ?? '', 'staging');
    expect(refused?.state).toBe('failed');
    expect(refused?.outcome_reason).toContain(
      'A Cloud Run service called cart-api already runs in staging, deployed outside Pipelines: adopt it first, or rename the application',
    );
  });

  it('plans the adoption without changing anything in the cloud', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const log = h.world.log.length;
    const answer = await api.get('/environments/staging/adoptions', h.users.admin);
    expect(answer.statusCode).toBe(200);
    const plan = adoptionPlanSchema.parse(answer.json());
    expect(plan.project).toBe(STAGE_PROJECT);
    expect(plan.services.map((s) => [s.service, s.state])).toEqual([
      ['cart-api', 'ready'],
      ['checkout-api', 'ready'],
      ['search-api', 'ready'],
    ]);
    const checkout = plan.services.find((s) => s.service === 'checkout-api');
    expect(checkout?.variables).toContainEqual(
      expect.objectContaining({
        name: 'CART_URL',
        reference: { application: 'cart-api', value: '${{ apps.cart-api.url }}/v2' },
      }),
    );
    expect(checkout?.variables).toContainEqual({
      name: 'API_KEY',
      kind: 'secret',
      location: `${STAGE_PROJECT} / checkout-api-key`,
      version: '1',
      problem: null,
    });
    expect(h.world.log.length).toBe(log);
    expect((await api.get('/environments/staging/adoptions', h.users.outsider)).statusCode).toBe(
      403,
    );
  });

  it('adopts all three: variables, secrets by reference, settings and release zero', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const body = {
      services: [
        { service: 'cart-api', application: 'cart-api' },
        { service: 'checkout-api', application: 'checkout-api', references: ['CART_URL'] },
        { service: 'search-api', application: 'search-api' },
      ],
    };
    const answer = await api.send('POST', '/environments/staging/adoptions', h.users.admin, body);
    expect(answer.statusCode).toBe(201);
    const result = adoptResultSchema.parse(answer.json());
    expect(result.adopted.map((x) => x.release.version)).toEqual([
      '0.0.0-adopted.staging',
      '0.0.0-adopted.staging',
      '0.0.0-adopted.staging',
    ]);
    expect(result.plan.services.every((s) => s.state === 'adopted')).toBe(true);
    const again = await api.send('POST', '/environments/staging/adoptions', h.users.admin, body);
    expect(again.statusCode).toBe(409);
    const listed = variablesResponseSchema.parse(
      (
        await api.get('/applications/checkout-api/variables?environment=staging', h.users.admin)
      ).json(),
    );
    expect(listed.items.find((v) => v.name === 'CART_URL')?.value).toBe(
      '${{ apps.cart-api.url }}/v2',
    );
    expect(listed.items.find((v) => v.name === 'API_KEY')).toMatchObject({
      kind: 'secret',
      state: 'set',
      version: 1,
      location: `${STAGE_PROJECT} / checkout-api-key`,
    });
    const [zero] = await h.sql<{ source: string; image_repository: string }[]>`
      select source, image_repository from pipeline_releases
      where application_id = ${gke.cart} and version = '0.0.0-adopted.staging'`;
    expect(zero).toEqual({
      source: 'adopted',
      image_repository: `fake.registry/${STAGE_PROJECT}/apps/cart-api`,
    });
  });

  it('rolls Staging forward from release zero, keeping it to roll back to', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h } = ready();
    expect((await ship(releases['cart-api'] ?? '', 'staging'))?.state).toBe('succeeded');
    const [deployment] = await h.sql<{ previous_revision: string | null; previous: string }[]>`
      select d.previous_revision, p.version as previous
      from pipeline_deployments d join pipeline_releases p on p.id = d.previous_release_id
      where d.application_id = ${gke.cart} and d.environment_id = ${f.environments.staging}
        and d.state = 'succeeded' order by d.created_at desc limit 1`;
    expect(deployment).toEqual({
      previous_revision: 'cart-api-00007-hnd',
      previous: '0.0.0-adopted.staging',
    });
    expect(latest('cart-api@staging')?.settings.scaling).toMatchObject({
      min: 0,
      max: 5,
      concurrency: 80,
    });
  });

  it('plans a copy to a fresh Prod on GKE, translated and with Prod keeping its minimum', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    await api.send('PATCH', `/environments/${PROD}`, h.users.admin, {
      defaultRuntime: 'gke-autopilot',
    });
    await api.send('POST', '/clusters', h.users.admin, {
      origin: 'created',
      environmentId: f.environments.prodAsia,
      mode: 'autopilot',
    });
    await api.get('/clusters', h.users.member);
    await api.get('/clusters', h.users.member);
    const plan = copyPlanSchema.parse(
      (await api.get(`/environments/${PROD}/copies?from=staging`, h.users.admin)).json(),
    );
    expect(plan.secretMode).toBe('needs-value');
    const item = (application: string, id: string) =>
      plan.applications
        .find((x) => x.application.key === application)
        ?.items.find((i) => i.id === `${application}:${id}`);
    expect(item('cart-api', 'setting:scaling.concurrency')).toMatchObject({
      applies: false,
      note: 'dropped',
    });
    expect(item('cart-api', 'setting:scaling.min')).toMatchObject({
      before: 2,
      after: 0,
      note: 'keeps-default',
      ticked: false,
    });
    expect(item('cart-api', 'secret:DB_PASSWORD')).toMatchObject({ mode: 'needs-value' });
    expect(item('checkout-api', 'variable:CART_URL')).toMatchObject({
      reference: true,
      before: null,
    });
  });

  it('copies: one secret store to store, the rest needing a value, then nothing differs', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const path = `/environments/${PROD}/copies`;
    const plan = copyPlanSchema.parse(
      (await api.get(`${path}?from=staging`, h.users.admin)).json(),
    );
    const items = plan.applications.flatMap((x) =>
      x.items
        .filter((i) => i.ticked)
        .map((i) => ({
          id: i.id,
          ...(i.id === 'cart-api:secret:DB_PASSWORD' ? { secret: 'copy' } : {}),
        })),
    );
    const body = { from: 'staging', items };
    expect((await api.send('POST', path, h.users.member, body)).statusCode).toBe(403);
    const answer = await api.send('POST', path, h.users.admin, body);
    expect(answer.statusCode).toBe(201);
    const result = copyResultSchema.parse(answer.json());
    expect(result.applied).toBe(items.length);
    const left: CopyItem[] = result.plan.applications.flatMap((x) => x.items);
    expect(left.filter((i) => i.ticked)).toEqual([]);
    const copied = `${'acme-prodasia'}/bemmoly-cart-api-DB_PASSWORD-${PROD}`;
    expect(h.world.secrets.get(copied)).toHaveLength(1);
    expect([...h.world.grants]).toContainEqual(
      `secret ${copied} fake-pods@bemmoly-${PROD}/checkout/cart-api`,
    );
    const [change] = await h.sql<{ summary: string }[]>`
      select summary from pipeline_changes
      where kind = 'config' and summary like 'Copy · cart-api%'`;
    expect(change?.summary).toBe(`Copy · cart-api configuration from staging to ${PROD}`);
  });

  it('runs Prod with the in-cluster address, the synced secret and two pods at least', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    for (const app of ['cart-api', 'checkout-api']) {
      expect((await ship(releases[app] ?? '', 'dev'))?.state).toBe('succeeded');
    }
    expect((await ship(releases['checkout-api'] ?? '', 'staging'))?.state).toBe('succeeded');
    expect((await ship(releases['cart-api'] ?? '', PROD))?.state).toBe('succeeded');
    const cart = latest(`bemmoly-${PROD}/checkout/cart-api@${PROD}`);
    expect(cart?.cluster?.autoscaler.min).toBe(2);
    expect(cart?.cluster?.secrets).toMatch(/^secret\/cart-api-/);
    expect(cart?.variables).toContainEqual(
      expect.objectContaining({ name: 'DB_PASSWORD', kind: 'secret', account: 'acme-prodasia' }),
    );
    const blocked = await ship(releases['checkout-api'] ?? '', PROD);
    expect(blocked?.state).toBe('failed');
    expect(blocked?.outcome_reason).toContain(
      `checkout-api's API_KEY needs a value in ${PROD}: set it in Variables, then deploy`,
    );
    const set = await api.send(
      'PUT',
      `/applications/checkout-api/variables/API_KEY?environment=${PROD}`,
      h.users.admin,
      {
        kind: 'secret',
        value: 'prod-only-checkout-key',
      },
    );
    expect(set.statusCode).toBe(200);
    expect((await ship(releases['checkout-api'] ?? '', PROD))?.state).toBe('succeeded');
    const checkout = latest(`bemmoly-${PROD}/checkout/checkout-api@${PROD}`);
    expect(checkout?.variables).toContainEqual({
      name: 'CART_URL',
      kind: 'plain',
      value: 'http://cart-api.checkout.svc.cluster.local:8080/v2',
    });
    for (const value of Object.values(a.sentinels)) {
      expect((await columnsHolding(h, value)).found).toEqual([]);
    }
  });
});
