import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runtimeMoveSchema } from '../../../../shared/moves.ts';
import { applicationRuntimesResponseSchema } from '../../../../shared/runtimes.ts';
import {
  HOST,
  PROD,
  startFrontDoorFixture,
  type FrontDoorFixture,
} from '../../testing/front-door-fixture.ts';

/*
 * The way back: a move rolled back by hand puts every request back on Cloud Run, one whose
 * new runtime fails its canary rolls back by itself, and while a move is open nothing else
 * deploys there and the front door stays on. Pause and Continue go through the API, as the
 * plan screen sends them. Not one request through the front door fails on the way.
 */

let fx: FrontDoorFixture | undefined;
let skip = '';

beforeAll(async () => {
  const started = await startFrontDoorFixture();
  if (!started.available) {
    skip = started.reason;
    return;
  }
  fx = started.fx;
  const { api, h, f } = fx;
  expect(await fx.ship(await f.release('v1.0.0'))).toBe('succeeded');
  const door = await api.send('PUT', `/environments/${PROD}/front-door`, h.users.admin, {
    enabled: true,
  });
  await h.services.frontDoors.apply(door.json().id);
});

afterAll(async () => {
  await fx?.api.app.close();
  await fx?.h.stop();
});

const ready = () => {
  if (!fx) throw new Error('no harness');
  return fx;
};

const lastRoute = () =>
  ready()
    .h.world.log.filter((line) => line.startsWith(`route ${HOST}@${PROD}`))
    .at(-1);

async function act(verb: string, id: string, as: string) {
  const response = await ready().api.send('POST', `/runtime-moves/${id}/${verb}`, as, {});
  return {
    status: response.statusCode,
    move: response.statusCode === 200 ? runtimeMoveSchema.parse(response.json()) : null,
  };
}

/** Ships a release that behaves `config` on GKE, then moves it there until it rolls back. */
async function moveWith(version: string, config: Record<string, unknown>) {
  const { h, f, moves, drive } = ready();
  expect(await ready().ship(await f.release(version, config))).toBe('succeeded');
  const plan = await ready().plan('gke-autopilot');
  await moves.start(h.as(h.users.member), plan.id);
  const ended = async () => (await ready().moveState(plan.id)) === 'rolled_back';
  expect(await drive(ended, 30)).toBe(true);
  return moves.get(h.as(h.users.member), plan.id);
}

describe('rolling a runtime move back', () => {
  it('pauses, continues and rolls back by hand, every request back on Cloud Run', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    const { h, moves } = ready();
    const plan = await ready().plan('gke-autopilot');
    expect((await act('start', plan.id, h.users.outsider)).status).toBe(403);
    const started = await moves.start(h.as(h.users.member), plan.id);
    expect(started).toMatchObject({ state: 'shifting', percent: 10 });
    expect(started.steps.map((step) => step.state)).toEqual(['current', 'next', 'next']);
    expect(lastRoute()).toMatch(/:10,cloud-run:90$/);
    const paused = await act('pause', plan.id, h.users.member);
    expect(paused.move).toMatchObject({ state: 'paused', can: { continue: true, pause: false } });
    expect((await act('pause', plan.id, h.users.member)).status).toBe(409);
    expect((await act('continue', plan.id, h.users.member)).move?.state).toBe('shifting');
    const back = await act('rollback', plan.id, h.users.member);
    expect(back.move).toMatchObject({ state: 'rolled_back', percent: 0 });
    expect(lastRoute()).toMatch(/ cloud-run:100$/);
    expect(h.world.log).toContain(`leave bemmoly-prod-asia-south1/checkout/checkout-api@${PROD}`);
    expect(ready().requests().failed).toBe(0);
    const runtimes = applicationRuntimesResponseSchema.parse(
      (await ready().api.get('/applications/checkout-api/runtimes', h.users.member)).json(),
    );
    expect(runtimes.items.find((item) => item.environment.key === PROD)).toMatchObject({
      runtime: 'cloud-run',
      move: null,
    });
  });

  it('holds deploys and the front door while a move is open', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    const { api, h, f, moves } = ready();
    const plan = await ready().plan('gke-autopilot');
    await moves.start(h.as(h.users.member), plan.id);
    await moves.pause(h.as(h.users.member), plan.id);
    const off = await api.send('PUT', `/environments/${PROD}/front-door`, h.users.admin, {
      enabled: false,
    });
    expect(off.statusCode).toBe(409);
    expect(await ready().ship(await f.release('v2.0.0'))).not.toBe('succeeded');
    const [deployment] = await h.sql<{ state: string; reason: string | null }[]>`
      select d.state, d.reason from pipeline_deployments d
      join pipeline_releases r on r.id = d.release_id
      where r.version = 'v2.0.0' and d.environment_id = ${f.environments.prodAsia}`;
    expect(deployment).toMatchObject({ state: 'failed' });
    expect(deployment?.reason).toMatch(/is moving to GKE Autopilot in prod-asia-south1/);
    await moves.rollback(h.as(h.users.member), plan.id);
    expect(ready().requests().failed).toBe(0);
  });

  it('rolls back by itself when the new runtime fails its canary', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    const slow = { 'fake.latencyMs@kubernetes': 400 };
    const move = await moveWith('v3.0.0', slow);
    expect(move.message).toBe('Rolled back at 10%: Latency p95 400 ms against 120 ms on stable');
    expect(lastRoute()).toMatch(/ cloud-run:100$/);
    expect(ready().requests().failed).toBe(0);
  });

  it('rolls back before any traffic when the new revision fails its health check', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    const move = await moveWith('v4.0.0', { 'fake.errorRate@kubernetes': 0.3 });
    expect(move.message).toBe(
      'Rolled back: checkout-api-v4.0.0-1 failed its health check on GKE Autopilot',
    );
    expect(move.steps.every((step) => step.state === 'next')).toBe(true);
    expect(ready().requests().failed).toBe(0);
  });
});
