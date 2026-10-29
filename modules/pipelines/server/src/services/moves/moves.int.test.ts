import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { frontDoorSchema, frontDoorsResponseSchema } from '../../../../shared/front-doors.ts';
import { applicationRuntimesResponseSchema } from '../../../../shared/runtimes.ts';
import {
  HOST,
  PROD,
  startFrontDoorFixture,
  type FrontDoorFixture,
} from '../../testing/front-door-fixture.ts';

/*
 * The milestone's proof: checkout-api moves from Cloud Run to GKE Autopilot in Prod and back
 * through the front door while a hundred requests a minute go through it, and none of them
 * fails. New revisions take two health checks to start, so a move that shifted before the
 * revision was up would lose requests. Canaries on GKE behind the front door still canary
 * and still roll back by themselves. The simulated cloud stands in for Google Cloud.
 */

let fx: FrontDoorFixture | undefined;
let skip = '';
let doorId = '';

beforeAll(async () => {
  const started = await startFrontDoorFixture();
  if (!started.available) {
    skip = started.reason;
    return;
  }
  fx = started.fx;
});

afterAll(async () => {
  await fx?.api.app.close();
  await fx?.h.stop();
});

const ready = () => {
  if (!fx) throw new Error('no harness');
  return fx;
};

async function runtimeIn(environment: string) {
  const { api, h } = ready();
  const listed = applicationRuntimesResponseSchema.parse(
    (await api.get('/applications/checkout-api/runtimes', h.users.member)).json(),
  );
  return listed.items.find((item) => item.environment.key === environment);
}

describe('a front door, and moving between runtimes through it', () => {
  it('turns on a front door that routes checkout-api to Cloud Run', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    const { api, h, f, ship } = ready();
    expect((await ship(await f.release('v1.0.0'))) ?? '').toBe('succeeded');
    const body = { enabled: true, domain: null };
    const denied = await api.send('PUT', `/environments/${PROD}/front-door`, h.users.member, body);
    expect(denied.statusCode).toBe(403);
    const set = await api.send('PUT', `/environments/${PROD}/front-door`, h.users.admin, body);
    expect(set.statusCode).toBe(200);
    const door = frontDoorSchema.parse(set.json());
    expect(door.status).toBe('pending');
    expect(h.jobs.map((job) => job.name)).toContain('pipelines.front-door-apply');
    doorId = door.id;
    await h.services.frontDoors.apply(door.id);
    const listed = frontDoorsResponseSchema.parse(
      (await api.get('/front-doors', h.users.member, { application: 'checkout-api' })).json(),
    );
    expect(listed.items[0]).toMatchObject({
      status: 'ready',
      addresses: [{ account: 'acme-prodasia', address: '203.0.113.10' }],
      routes: [
        {
          host: HOST,
          url: 'http://203.0.113.10',
          backends: [{ runtime: 'cloud-run', revision: null, percent: 100 }],
        },
      ],
    });
    expect(await runtimeIn(PROD)).toMatchObject({
      runtime: 'cloud-run',
      frontDoor: { host: HOST, url: 'http://203.0.113.10' },
    });
    expect((await runtimeIn('dev'))?.frontDoor).toBeNull();
  });

  it('plans a move with its steps, downtime, cost and what is untested first', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    const plan = await ready().plan('gke-autopilot');
    expect(plan).toMatchObject({
      from: 'cloud-run',
      to: 'gke-autopilot',
      state: 'planned',
      downtime: 'none',
      release: { version: 'v1.0.0' },
      frontDoor: { host: HOST },
      can: { start: true, pause: false, continue: false, rollBack: true },
    });
    expect(plan.steps.map((step) => [step.percent, step.state])).toEqual([
      [10, 'next'],
      [50, 'next'],
      [100, 'next'],
    ]);
    expect(plan.cost).toMatchObject({ estimate: true, pricesAsOf: '2026-10-29' });
    expect(plan.cost.lines.map((line) => line.item)).toEqual([
      'front-door',
      'runtime',
      'runtime',
      'cluster',
    ]);
    expect(plan.cost.difference).toBeLessThan(0);
    expect(plan.untested.length).toBeGreaterThan(0);
    expect(await runtimeIn(PROD)).toMatchObject({
      runtime: 'cloud-run',
      move: { state: 'planned', to: 'gke-autopilot' },
    });
  });

  it('moves checkout-api to GKE with no failed requests', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    const { h, moves, drive } = ready();
    h.world.revisionWarmup = 2;
    const plan = await ready().plan('gke-autopilot');
    const started = await moves.start(h.as(h.users.member), plan.id);
    expect(started.state).toBe('warming');
    const before = ready().requests();
    expect(await drive(async () => (await ready().moveState(plan.id)) === 'succeeded', 90)).toBe(
      true,
    );
    const after = ready().requests();
    expect(after.sent - before.sent).toBeGreaterThan(3000);
    expect(after.failed).toBe(0);
    const routes = h.world.log.filter((line) => line.startsWith(`route ${HOST}@${PROD}`));
    expect(routes.some((line) => /:10,cloud-run:90$/.test(line))).toBe(true);
    expect(routes.some((line) => /:50,cloud-run:50$/.test(line))).toBe(true);
    expect(h.world.log).toContain(`leave checkout-api@${PROD}`);
    expect(await runtimeIn(PROD)).toMatchObject({
      runtime: 'gke-autopilot',
      source: 'pipelines',
      move: null,
    });
    h.world.revisionWarmup = 0;
  });

  it('still canaries on GKE behind the front door, and rolls back by itself', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    const { f, h, ship } = ready();
    expect(await ship(await f.release('v2.0.0'))).toBe('succeeded');
    const canary = h.world.log.filter(
      (line) => line.startsWith(`route ${HOST}@${PROD}`) && /v2\.0\.0-\d+:5,/.test(line),
    );
    expect(canary).toHaveLength(1);
    const failing = { 'fake.errorRate@prod-asia-south1': 0.3 };
    expect(await ship(await f.release('v3.0.0', failing))).toBe('rolled_back');
    const last = h.world.log.filter((line) => line.startsWith(`route ${HOST}@${PROD}`)).at(-1);
    expect(last).toMatch(/v2\.0\.0-\d+:100$/);
    expect(ready().requests().failed).toBe(0);
  });

  it('moves back to Cloud Run with no failed requests, following the default again', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    const { h, moves, drive } = ready();
    const plan = await ready().plan(null);
    expect(plan).toMatchObject({ from: 'gke-autopilot', to: 'cloud-run' });
    await moves.start(h.as(h.users.member), plan.id);
    expect(await drive(async () => (await ready().moveState(plan.id)) === 'succeeded', 90)).toBe(
      true,
    );
    expect(ready().requests().failed).toBe(0);
    expect(h.world.log).toContain(`leave bemmoly-prod-asia-south1/checkout/checkout-api@${PROD}`);
    expect(await runtimeIn(PROD)).toMatchObject({ runtime: 'cloud-run', source: 'environment' });
  });

  it('turns the front door off, taking it down', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    const { api, h } = ready();
    const off = await api.send('PUT', `/environments/${PROD}/front-door`, h.users.admin, {
      enabled: false,
    });
    expect(off.statusCode).toBe(200);
    await h.services.frontDoors.apply(doorId);
    expect(h.world.frontDoors.has(PROD)).toBe(false);
    expect(await runtimeIn(PROD)).toMatchObject({ frontDoor: null });
  });
});
