import { expect } from 'vitest';
import { runtimeMovesResponseSchema, type RuntimeMove } from '../../../shared/moves.ts';
import { createAccessEngine } from '../services/access/engine.ts';
import { createMovesService, type MovesService } from '../services/moves/index.ts';
import { createFakeProvider } from '../services/providers/fake/index.ts';
import { sendThroughFrontDoor } from '../services/providers/fake/front-door.ts';
import { createProviderRegistry } from '../services/providers/registry.ts';
import { startPipelinesHarness, type PipelinesHarness } from './harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from './http.ts';
import { seedGkeFixture } from './gke-fixture.ts';
import { seedShippingFixture, type ShippingFixture } from './shipping-fixture.ts';

/*
 * checkout-api on Cloud Run in four environments, each with a project, and Prod in
 * asia-south1 with an Autopilot cluster and its front door turned on, ready to move. The
 * moves engine runs on the shipping fixture's clock, and every minute the test moves the
 * clock it sends requests through the front door, so a move's whole life is counted.
 */

export const PROD = 'prod-asia-south1';
export const HOST = 'checkout-api';

export interface FrontDoorFixture {
  h: PipelinesHarness;
  api: PipelinesHttp;
  f: ShippingFixture;
  moves: MovesService;
  /** Requests sent through the front door so far, and how many reached nothing running. */
  requests(): { sent: number; failed: number };
  /** Minute by minute: both engines sweep, 100 requests go through, the clock moves on. */
  drive(done: () => Promise<boolean>, minutes: number): Promise<boolean>;
  /** One release to Dev, Staging and both Prods, approving Prod; answers Prod's end. */
  ship(release: string): Promise<string | undefined>;
  /** Switches the runtime in Prod asia and answers the move it planned. */
  plan(runtime: string | null): Promise<RuntimeMove>;
  moveState(id: string): Promise<string | undefined>;
}

export async function startFrontDoorFixture(): Promise<
  { available: true; fx: FrontDoorFixture } | { available: false; reason: string }
> {
  const started = await startPipelinesHarness();
  if (!started.available) return started;
  const h = started.harness;
  const api = await startPipelinesHttp(h);
  const f = await seedShippingFixture(h, {
    world: h.world,
    variables: (application, environment) =>
      h.services.variables.forDeploy(application, environment),
  });
  await seedGkeFixture(h, f);
  const moves = createMovesService({
    database: h.sql,
    access: createAccessEngine({ database: h.sql }),
    providers: createProviderRegistry([createFakeProvider(h.world, 'gcp')]),
    now: () => f.clock.now,
  });
  const cluster = await api.send('POST', '/clusters', h.users.admin, {
    origin: 'created',
    environmentId: f.environments.prodAsia,
    mode: 'autopilot',
  });
  expect(cluster.statusCode).toBe(201);
  await api.get('/clusters', h.users.admin);
  await api.get('/clusters', h.users.admin);

  const promotionState = async (id: string) => {
    const [row] = await h.sql<{ state: string }[]>`
      select state from pipeline_promotions where id = ${id}`;
    return row?.state;
  };
  const moveState = async (id: string) => {
    const [row] = await h.sql<{ state: string }[]>`
      select state from pipeline_runtime_moves where id = ${id}`;
    return row?.state;
  };

  const fx: FrontDoorFixture = {
    h,
    api,
    f,
    moves,
    requests: () => ({ ...h.world.frontDoorRequests }),
    async drive(done, minutes) {
      for (let minute = 0; minute <= minutes; minute += 1) {
        await f.service.engine.sweep();
        await moves.engine?.sweep();
        if (h.world.frontDoors.has(PROD)) sendThroughFrontDoor(h.world, PROD, HOST, 100);
        if (await done()) return true;
        f.clock.advance(60_000);
      }
      return done();
    },
    async ship(release) {
      const priya = h.as(h.users.member);
      for (const to of ['dev', 'staging']) {
        const { promotion } = await f.service.requestPromotion(priya, {
          release,
          to,
          mode: 'approval',
        });
        expect(
          await fx.drive(async () => (await promotionState(promotion.id)) === 'succeeded', 30),
        ).toBe(true);
      }
      const { promotion } = await f.service.requestPromotion(priya, {
        release,
        to: 'prod',
        mode: 'approval',
      });
      await f.service.decide(h.as(f.ravi), promotion.id, {
        decision: 'approved',
        releaseDigest: promotion.release.digest,
      });
      const ended = async () =>
        ['succeeded', 'rolled_back', 'failed'].includes((await promotionState(promotion.id)) ?? '');
      expect(await fx.drive(ended, 180)).toBe(true);
      return promotionState(promotion.id);
    },
    async plan(runtime) {
      const set = await api.send(
        'PUT',
        `/applications/checkout-api/runtimes/${PROD}`,
        h.users.member,
        { runtime },
      );
      expect(set.statusCode, set.body).toBe(200);
      const listed = runtimeMovesResponseSchema.parse(
        (await api.get('/runtime-moves', h.users.member, { application: 'checkout-api' })).json(),
      );
      const planned = listed.items.find((item) => item.state === 'planned');
      if (!planned) throw new Error('No move was planned');
      return planned;
    },
    moveState,
  };
  return { available: true, fx };
}
