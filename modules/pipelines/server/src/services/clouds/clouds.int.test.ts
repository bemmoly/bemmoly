import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cloudAccountsResponseSchema,
  cloudConnectionSchema,
  cloudResourcesResponseSchema,
  connectionsResponseSchema,
  landingZonePlanSchema,
  providersResponseSchema,
} from '../../../../shared/clouds.ts';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';

/* Platform › Clouds over HTTP: who may do what, and the connect, plan, apply journey. */

let harness: PipelinesHarness | undefined;
let http: PipelinesHttp | undefined;
let skip = '';

beforeAll(async () => {
  const started = await startPipelinesHarness();
  if (!started.available) {
    skip = started.reason;
    return;
  }
  harness = started.harness;
  http = await startPipelinesHttp(harness);
  await seedCatalogFixture(harness.sql, harness.users.member);
});

afterAll(async () => {
  await http?.app.close();
  await harness?.stop();
});

const ready = () => {
  if (!harness || !http) throw new Error('no harness');
  return { h: harness, api: http };
};

const gcpBody = {
  provider: 'gcp',
  name: 'Acme Google Cloud',
  organizationId: '583920174411',
  billingAccountId: '01A2B3-C4D5E6-F7A8B9',
};

describe('Platform › Clouds endpoints', () => {
  it('lists the providers, Google Cloud available and the rest coming soon', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const response = await api.get('/clouds/providers', h.users.member);
    expect(response.statusCode).toBe(200);
    const { items } = providersResponseSchema.parse(response.json());
    expect(items.map((item) => [item.provider, item.availability])).toEqual([
      ['gcp', 'available'],
      ['aws', 'coming_soon'],
      ['kubernetes', 'coming_soon'],
      ['azure', 'coming_soon'],
    ]);
    expect((await api.get('/clouds/providers', h.users.outsider)).statusCode).toBe(403);
  });

  it('lets only a platform admin connect, and refuses clouds that are coming soon', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    expect((await api.send('POST', '/clouds', h.users.member, gcpBody)).statusCode).toBe(403);
    const aws = await api.send('POST', '/clouds', h.users.admin, {
      provider: 'aws',
      name: 'Acme AWS',
      adminEmail: 'cloud@acme.example',
    });
    expect(aws.statusCode).toBe(400);
    expect(aws.json().message).toBe('Amazon Web Services is coming soon');
    expect((await api.send('POST', '/clouds', h.users.admin, { provider: 'gcp' })).statusCode).toBe(
      400,
    );

    const created = await api.send('POST', '/clouds', h.users.admin, gcpBody);
    expect(created.statusCode).toBe(201);
    expect(cloudConnectionSchema.parse(created.json())).toMatchObject({
      provider: 'gcp',
      status: 'pending',
      layout: 'per-domain-environment',
      boundary: null,
    });
    expect((await api.send('POST', '/clouds', h.users.admin, gcpBody)).statusCode).toBe(409);

    const local = await api.send('POST', '/clouds', h.users.admin, {
      provider: 'local',
      name: 'Laptop',
    });
    expect(local.statusCode).toBe(201);
    const list = connectionsResponseSchema.parse((await api.get('/clouds', h.users.member)).json());
    expect(list.items.map((item) => item.name)).toEqual(['Acme Google Cloud', 'Laptop']);
  });

  it('checks, previews and applies a landing zone only as it was previewed', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const [row] = await h.sql<
      { id: string }[]
    >`select id from cloud_connections where provider = 'gcp'`;
    const id = row?.id ?? '';

    const unchecked = landingZonePlanSchema.parse(
      (await api.send('POST', `/clouds/${id}/plan`, h.users.admin, {})).json(),
    );
    expect(unchecked.blockers).toEqual([expect.stringContaining('Check the connection first')]);

    const checked = await api.send('POST', `/clouds/${id}/check`, h.users.admin);
    expect(checked.json()).toMatchObject({
      status: 'connected',
      principal: 'fake-control@Acme Google Cloud',
    });

    const response = await api.send('POST', `/clouds/${id}/plan`, h.users.admin, {
      layout: 'per-environment',
      environments: ['dev', 'prod-asia-south1'],
    });
    expect(response.statusCode).toBe(200);
    const plan = landingZonePlanSchema.parse(response.json());
    expect(plan).toMatchObject({
      layout: 'per-environment',
      blockers: [],
      counts: { accounts: 4 },
    });
    expect(plan.root.children.map((child) => child.note)).toEqual([
      'Bemmoly control',
      'Bemmoly CI',
      'Dev',
      'Prod · asia-south1',
    ]);
    expect((await api.send('POST', `/clouds/${id}/plan`, h.users.member, {})).statusCode).toBe(403);

    const wrong = await api.send('POST', `/clouds/${id}/apply`, h.users.admin, {
      planId: plan.planId,
      specHash: 'not-what-you-saw',
    });
    expect(wrong.statusCode).toBe(409);

    const applied = await api.send('POST', `/clouds/${id}/apply`, h.users.admin, {
      planId: plan.planId,
      specHash: plan.specHash,
    });
    expect(applied.statusCode).toBe(202);
    expect(h.jobs.at(-1)).toMatchObject({
      name: 'pipelines.landing-zone-apply',
      payload: { planId: plan.planId },
    });
    await h.services.clouds.runApply(plan.planId);

    const accounts = cloudAccountsResponseSchema.parse(
      (await api.get(`/clouds/${id}/accounts`, h.users.member)).json(),
    );
    expect(accounts.items.map((account) => [account.purpose, account.status])).toEqual([
      ['control', 'ready'],
      ['ci', 'ready'],
      ['workload', 'ready'],
      ['workload', 'ready'],
    ]);
    const resources = cloudResourcesResponseSchema.parse(
      (await api.get(`/clouds/${id}/resources`, h.users.member)).json(),
    );
    expect(resources.items).toHaveLength(plan.counts.accounts + plan.counts.resources);
    const connection = (await api.get('/clouds', h.users.member)).json().items[0];
    expect(connection).toMatchObject({ boundary: 'Bemmoly', layout: 'per-environment' });
    const [dev] = await h.sql<{ cloud_account_id: string | null }[]>`
      select cloud_account_id from pipeline_environments where key = 'dev'`;
    expect(dev?.cloud_account_id).toBeTruthy();
  });

  it('answers 404 for a connection that does not exist', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const missing = '0199f0aa-0000-7000-8000-0000000000ff';
    expect((await api.get(`/clouds/${missing}/accounts`, h.users.member)).statusCode).toBe(404);
    expect((await api.send('POST', `/clouds/${missing}/check`, h.users.admin)).statusCode).toBe(
      404,
    );
  });
});
