import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { variableSchema, variablesResponseSchema } from '../../../../shared/variables.ts';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';
import {
  attachSecretsPlace,
  columnsHolding,
  type SecretsPlace,
} from '../../testing/variables-fixture.ts';

/*
 * Variables and secrets over HTTP: who may set them where, a secret's value going to the
 * simulated store and nowhere else, and deleting. Priya is in Payments, which owns
 * checkout-api, so she is its Maintainer; Ada is an organisation admin.
 */

const SENTINEL = 'sentinel-7f3c9a1e-plain-test-value';
const CI_SENTINEL = 'sentinel-2b8d4e60-plain-test-value';
const APP = '/applications/checkout-api/variables';

let harness: PipelinesHarness | undefined;
let http: PipelinesHttp | undefined;
let place: SecretsPlace | undefined;
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
  place = await attachSecretsPlace(harness, http, { chooseCi: false });
});

afterAll(async () => {
  await http?.app.close();
  await harness?.stop();
});

const ready = () => {
  if (!harness || !http || !place) throw new Error('no harness');
  return { h: harness, api: http, place };
};

const plain = (value: string) => ({ kind: 'plain', value });
const secret = (value: string) => ({ kind: 'secret', value });

describe('plain variables', () => {
  it('sets one for an environment and lists it with who set it, counting each set', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const path = `${APP}/LOG_LEVEL?environment=dev`;
    expect((await api.send('PUT', path, h.users.member, plain('debug'))).statusCode).toBe(200);
    const again = variableSchema.parse(
      (await api.send('PUT', path, h.users.member, plain('trace'))).json(),
    );
    expect(again).toMatchObject({ name: 'LOG_LEVEL', kind: 'plain', value: 'trace', version: 2 });
    const list = variablesResponseSchema.parse((await api.get(APP, h.users.member)).json());
    expect(list.canChange).toBe(true);
    expect(list.environments.map((env) => env.key)).toEqual(['dev', 'staging', 'prod-asia-south1']);
    expect(list.items).toEqual([
      expect.objectContaining({
        name: 'LOG_LEVEL',
        environment: expect.objectContaining({ key: 'dev' }),
        state: 'set',
        updatedBy: expect.objectContaining({ name: 'Priya Sharma' }),
      }),
    ]);
    expect((await api.get(APP, h.users.outsider)).statusCode).toBe(403);
    const bad = await api.send('PUT', `${APP}/log-level`, h.users.member, plain('x'));
    expect(bad.statusCode).toBe(400);
  });

  it('keeps a protected environment for the roles that may deploy there', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const prod = await api.send(
      'PUT',
      `${APP}/REGION?environment=prod-asia-south1`,
      h.users.member,
      plain('in'),
    );
    expect(prod.statusCode).toBe(403);
    expect(prod.json().message).toContain('needs a Release manager');
    // A value for every environment would reach Prod, which has none of its own.
    expect((await api.send('PUT', `${APP}/REGION`, h.users.member, plain('in'))).statusCode).toBe(
      403,
    );
    expect((await api.send('PUT', `${APP}/REGION`, h.users.admin, plain('in'))).statusCode).toBe(
      200,
    );
    await api.send(
      'PUT',
      `${APP}/REGION?environment=prod-asia-south1`,
      h.users.admin,
      plain('asia'),
    );
    expect((await api.send('PUT', `${APP}/REGION`, h.users.member, plain('eu'))).statusCode).toBe(
      200,
    );
    const [decision] = await h.sql<{ n: number }[]>`
      select count(*)::int as n from pipeline_decisions where action = 'change_variables'`;
    expect(decision?.n).toBeGreaterThan(0);
  });
});

describe('secrets', () => {
  it('says where a secret cannot live, and what to do about it', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api, place } = ready();
    const staging = await api.send(
      'PUT',
      `${APP}/API_KEY?environment=staging`,
      h.users.admin,
      secret('x'),
    );
    expect(staging.statusCode).toBe(400);
    expect(staging.json().message).toBe(
      'staging has no project yet. Choose one in Platform › Environments, then set the secret again',
    );
    const shared = await api.send('PUT', `${APP}/NPM_TOKEN`, h.users.admin, secret('x'));
    expect(shared.json().message).toMatch(/^No project holds CI secrets yet/);
    const chosen = await api.send('PATCH', `/clouds/${place.connection}`, h.users.admin, {
      ciAccountId: place.accounts.ci,
    });
    expect(chosen.json().ciAccountId).toBe(place.accounts.ci);
    expect(h.world.secrets.size).toBe(0);
  });

  it('writes the value to the store and answers with its version only', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    const set = await api.send(
      'PUT',
      `${APP}/API_KEY?environment=prod-asia-south1`,
      h.users.admin,
      secret(SENTINEL),
    );
    expect(set.statusCode).toBe(200);
    expect(set.body).not.toContain(SENTINEL);
    expect(variableSchema.parse(set.json())).toMatchObject({
      kind: 'secret',
      value: null,
      version: 1,
      state: 'set',
      location: 'acme-shop-prod / bemmoly-checkout-api-API_KEY-prod-asia-south1',
    });
    const ci = await api.send('PUT', `${APP}/NPM_TOKEN`, h.users.admin, secret(CI_SENTINEL));
    expect(ci.json()).toMatchObject({
      version: 1,
      location: 'acme-shop-ci / bemmoly-checkout-api-NPM_TOKEN',
    });
    const replaced = await api.send(
      'PUT',
      `${APP}/API_KEY?environment=prod-asia-south1`,
      h.users.admin,
      secret(`${SENTINEL}-2`),
    );
    expect(replaced.json().version).toBe(2);
    expect(
      h.world.secrets.get('acme-shop-prod/bemmoly-checkout-api-API_KEY-prod-asia-south1'),
    ).toHaveLength(2);
    const listed = await api.get(APP, h.users.member, { environment: 'prod-asia-south1' });
    expect(listed.body).not.toContain(SENTINEL);
    expect(variablesResponseSchema.parse(listed.json()).items.map((item) => item.name)).toEqual([
      'API_KEY',
      'NPM_TOKEN',
      'REGION',
      'REGION',
    ]);
  });

  it('leaves no secret value in any text or jsonb column of the database', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    // The search itself finds a plain value, so finding no secret means something.
    const marker = 'marker-5e0a77c3-plain-value';
    await api.send('PUT', `${APP}/MARKER?environment=dev`, h.users.admin, plain(marker));
    expect((await columnsHolding(h, marker)).found).toEqual(['pipeline_variables.value']);
    for (const needle of [SENTINEL, CI_SENTINEL]) {
      const { searched, found } = await columnsHolding(h, needle);
      expect(searched).toBeGreaterThan(100);
      expect(found).toEqual([]);
    }
  });

  it('logs no request body that carries a value', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h } = ready();
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const logged = await startPipelinesHttp(h, { logTo: stream });
    const value = 'sentinel-91c0d2aa-plain-test-value';
    await logged.send('PUT', `${APP}/LOGGED?environment=dev`, h.users.admin, secret(value));
    // A refusal is logged too; its body is not.
    await logged.send('PUT', `${APP}/LOGGED?environment=staging`, h.users.admin, secret(value));
    await logged.app.close();
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join('')).not.toContain(value);
  });

  it('deletes a variable; a secret stays in the store for revisions that still read it', async (ctx) => {
    if (!harness) return ctx.skip(skip);
    const { h, api } = ready();
    expect(
      (await api.send('DELETE', `${APP}/LOG_LEVEL?environment=dev`, h.users.member)).statusCode,
    ).toBe(204);
    expect(
      (await api.send('DELETE', `${APP}/LOG_LEVEL?environment=dev`, h.users.member)).statusCode,
    ).toBe(404);
    expect(
      (await api.send('DELETE', `${APP}/API_KEY?environment=prod-asia-south1`, h.users.member))
        .statusCode,
    ).toBe(403);
    expect(
      (await api.send('DELETE', `${APP}/API_KEY?environment=prod-asia-south1`, h.users.admin))
        .statusCode,
    ).toBe(204);
    expect(
      h.world.secrets.has('acme-shop-prod/bemmoly-checkout-api-API_KEY-prod-asia-south1'),
    ).toBe(true);
  });
});
