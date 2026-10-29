import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cloudAccountSchema, cloudConnectionSchema } from '../../../../shared/clouds.ts';
import {
  environmentPathSchema,
  environmentPathsResponseSchema,
  environmentSchema,
  environmentsResponseSchema,
} from '../../../../shared/environments.ts';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';
import { createDefaultProviders } from '../providers/index.ts';
import { createProviderRegistry } from '../providers/registry.ts';
import { resolveTarget } from '../shipping/targets.ts';

/*
 * The attached journey over HTTP: connect Google Cloud with projects that already exist, attach
 * one, create environments that deploy into it, set the path releases take, and resolve where an
 * application would deploy. The simulated cloud stands in for Google Cloud.
 */

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

const state = { connection: '', account: '', blocked: '', dev: '', prod: '' };

describe('an attached Google Cloud connection', () => {
  it('connects with projects you already have, needing no organization or billing account', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const body = {
      provider: 'gcp',
      name: 'Nila Google Cloud',
      mode: 'attached',
      signIn: 'application_default',
    };
    expect((await api.send('POST', '/clouds', h.users.member, body)).statusCode).toBe(403);
    const managed = await api.send('POST', '/clouds', h.users.admin, { ...body, mode: 'managed' });
    expect(managed.statusCode).toBe(400);
    const created = await api.send('POST', '/clouds', h.users.admin, body);
    expect(created.statusCode).toBe(201);
    const connection = cloudConnectionSchema.parse(created.json());
    expect(connection).toMatchObject({
      mode: 'attached',
      signIn: 'application_default',
      region: 'us-central1',
      registry: null,
    });
    state.connection = connection.id;
    const checked = await api.send('POST', `/clouds/${connection.id}/check`, h.users.admin);
    expect(cloudConnectionSchema.parse(checked.json()).status).toBe('connected');
  });

  it('refuses a landing zone: an attached connection creates nothing', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const plan = await api.send('POST', `/clouds/${state.connection}/plan`, h.users.admin, {});
    expect(plan.json().blockers?.[0] ?? plan.json().message).toMatch(/creates none/);
  });

  it('attaches a project, recording what the check found', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const path = `/clouds/${state.connection}/accounts`;
    expect(
      (await api.send('POST', path, h.users.member, { externalId: 'nila-shop-prod' })).statusCode,
    ).toBe(403);
    const attached = await api.send('POST', path, h.users.admin, {
      externalId: 'nila-shop-prod',
      deployerServiceAccount: 'deployer@nila-shop-prod.iam.gserviceaccount.com',
    });
    expect(attached.statusCode).toBe(201);
    const account = cloudAccountSchema.parse(attached.json());
    expect(account).toMatchObject({
      externalId: 'nila-shop-prod',
      name: 'Simulated nila-shop-prod',
      origin: 'attached',
      status: 'ready',
      deployerServiceAccount: 'deployer@nila-shop-prod.iam.gserviceaccount.com',
      runtimeServiceAccount: null,
      problems: [],
    });
    state.account = account.id;

    h.world.accountProblems.set('nila-shop-dev', [
      'Turn on the Cloud Run Admin API in nila-shop-dev',
    ]);
    const blocked = cloudAccountSchema.parse(
      (
        await api.send('POST', path, h.users.admin, {
          externalId: 'nila-shop-dev',
          name: 'Shop dev',
        })
      ).json(),
    );
    expect(blocked).toMatchObject({
      name: 'Shop dev',
      status: 'failed',
      problems: ['Turn on the Cloud Run Admin API in nila-shop-dev'],
    });
    state.blocked = blocked.id;
  });

  it('sets where runners push images, and clears it', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const registry = 'us-central1-docker.pkg.dev/nila-ci/apps';
    const set = await api.send('PATCH', `/clouds/${state.connection}`, h.users.admin, { registry });
    expect(cloudConnectionSchema.parse(set.json()).registry).toBe(registry);
    const bad = await api.send('PATCH', `/clouds/${state.connection}`, h.users.admin, {
      registry: 'not a path',
    });
    expect(bad.statusCode).toBe(400);
  });
});

describe('environments you create', () => {
  it('creates environments in attached projects, refusing a project that failed its check', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const dev = {
      key: 'shop-dev',
      name: 'Shop dev',
      class: 'dev',
      cloudAccountId: state.account,
      region: 'europe-west1',
    };
    expect((await api.send('POST', '/environments', h.users.member, dev)).statusCode).toBe(403);
    const failed = await api.send('POST', '/environments', h.users.admin, {
      ...dev,
      cloudAccountId: state.blocked,
    });
    expect(failed.statusCode).toBe(400);
    expect(failed.json().message).toMatch(/failed its last check/);

    const created = environmentSchema.parse(
      (await api.send('POST', '/environments', h.users.admin, dev)).json(),
    );
    expect(created).toMatchObject({
      key: 'shop-dev',
      region: 'europe-west1',
      cloudAccount: { externalId: 'nila-shop-prod' },
      protection: { protected: false },
    });
    state.dev = created.id;
    expect((await api.send('POST', '/environments', h.users.admin, dev)).statusCode).toBe(409);

    const prod = environmentSchema.parse(
      (
        await api.send('POST', '/environments', h.users.admin, {
          key: 'shop-prod',
          name: 'Shop prod',
          class: 'prod',
          cloudAccountId: state.account,
        })
      ).json(),
    );
    // Production is protected and asks for an approval unless the admin says otherwise.
    expect(prod.protection).toMatchObject({ protected: true, requiresApproval: true });
    expect(prod.position).toBeGreaterThan(created.position);
    state.prod = prod.id;
  });

  it('edits an environment, keeping protection it was not asked to change', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const edited = environmentSchema.parse(
      (
        await api.send('PATCH', '/environments/shop-prod', h.users.admin, {
          name: 'Production',
          protection: { window: 'Mon-Thu 10:00-16:00 Europe/London' },
        })
      ).json(),
    );
    expect(edited.name).toBe('Production');
    expect(edited.protection).toMatchObject({
      requiresApproval: true,
      window: 'Mon-Thu 10:00-16:00 Europe/London',
    });
    expect((await api.send('PATCH', '/environments/shop-prod', h.users.admin, {})).statusCode).toBe(
      400,
    );
    expect(
      (await api.send('PATCH', '/environments/nowhere', h.users.admin, { name: 'x' })).statusCode,
    ).toBe(404);
  });

  it('sets the path a tier takes, replacing what was there', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const steps = [
      { environmentId: state.dev, stage: 0, autoPromote: true },
      { environmentId: state.prod, stage: 1, bakeMinutes: 30 },
    ];
    expect(
      (await api.send('PUT', '/environments/paths/1', h.users.member, { steps })).statusCode,
    ).toBe(403);
    const twice = await api.send('PUT', '/environments/paths/1', h.users.admin, {
      steps: [steps[0], steps[0]],
    });
    expect(twice.statusCode).toBe(400);
    const path = environmentPathSchema.parse(
      (await api.send('PUT', '/environments/paths/1', h.users.admin, { steps })).json(),
    );
    expect(
      path.steps.map((step) => [
        step.environment.key,
        step.stage,
        step.bakeMinutes,
        step.autoPromote,
      ]),
    ).toEqual([
      ['shop-dev', 0, 0, true],
      ['shop-prod', 1, 30, false],
    ]);
    const all = environmentPathsResponseSchema.parse(
      (await api.get('/environments/paths', h.users.member)).json(),
    );
    expect(all.items.find((item) => item.tier === 1)?.steps).toHaveLength(2);
  });

  it('resolves where an application deploys, acting as the attached project’s deployer', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h } = ready();
    const [app] = await h.sql<
      { id: string }[]
    >`select id from pipeline_applications order by key limit 1`;
    const registry = createProviderRegistry(
      createDefaultProviders({ simulate: true, world: h.world }),
    );
    const { target } = await resolveTarget(h.sql, registry, app!.id, state.prod);
    expect(target.connection.config['mode']).toBe('attached');
    expect(target.account).toMatchObject({
      externalId: 'nila-shop-prod',
      config: { deployerServiceAccount: 'deployer@nila-shop-prod.iam.gserviceaccount.com' },
    });
  });

  it('keeps an attached project while environments deploy into it, and archives an environment off its path', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const detach = await api.send(
      'DELETE',
      `/clouds/${state.connection}/accounts/${state.account}`,
      h.users.admin,
    );
    expect(detach.statusCode).toBe(409);
    expect(detach.json().message).toMatch(/shop-dev, shop-prod still deploy into nila-shop-prod/);
    expect(
      (
        await api.send(
          'DELETE',
          `/clouds/${state.connection}/accounts/${state.blocked}`,
          h.users.admin,
        )
      ).statusCode,
    ).toBe(204);

    expect((await api.send('DELETE', '/environments/shop-dev', h.users.member)).statusCode).toBe(
      403,
    );
    expect((await api.send('DELETE', '/environments/shop-dev', h.users.admin)).statusCode).toBe(
      204,
    );
    const left = environmentsResponseSchema.parse(
      (await api.get('/environments', h.users.member)).json(),
    );
    expect(left.items.map((item) => item.key)).not.toContain('shop-dev');
    const paths = environmentPathsResponseSchema.parse(
      (await api.get('/environments/paths', h.users.member)).json(),
    );
    expect(
      paths.items.find((item) => item.tier === 1)?.steps.map((step) => step.environment.key),
    ).toEqual(['shop-prod']);
  });
});
