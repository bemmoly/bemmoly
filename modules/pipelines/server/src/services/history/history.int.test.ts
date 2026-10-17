import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { changesResponseSchema } from '../../../../shared/changes.ts';
import { currentResponseSchema } from '../../../../shared/deployments.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';
import { seedShippingFixture, type ShippingFixture } from '../../testing/shipping-fixture.ts';
import { createHistoryService } from './index.ts';
import { recordChange } from './record.ts';

/* Current state now and rewound, across an hourly snapshot, and What changed?. */

describe('history', () => {
  let harness: PipelinesHarness | undefined;
  let http: PipelinesHttp;
  let f: ShippingFixture;
  let reason = '';
  const marks: Record<string, string> = {};

  async function ship(version: string) {
    if (!harness) return;
    const release = await f.release(version);
    const { promotion } = await f.service.requestPromotion(harness.as(harness.users.member), {
      release,
      to: 'dev',
      mode: 'approval',
    });
    const sql = harness.sql;
    await f.runUntil(async () => {
      const [row] = await sql<{ state: string }[]>`
        select state from pipeline_promotions where id = ${promotion.id}`;
      return row?.state === 'succeeded';
    }, 5);
  }

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    f = await seedShippingFixture(harness);
    http = await startPipelinesHttp(harness);
    const history = createHistoryService({ database: harness.sql, now: () => f.clock.now });
    await ship('v1.0.0');
    f.clock.advance(10 * 60_000);
    marks['afterV1'] = f.clock.now.toISOString();
    await history.snapshot(90);
    f.clock.advance(10 * 60_000);
    await ship('v2.0.0');
    f.clock.advance(10 * 60_000);
    marks['afterV2'] = f.clock.now.toISOString();
  });

  afterAll(async () => {
    await http?.app.close();
    await harness?.stop();
  });

  const read = async (query: Record<string, string>) =>
    currentResponseSchema.parse(
      (await http.get('/current', harness?.users.member ?? '', query)).json(),
    );

  it('answers what runs where now', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const now = await read({ application: 'checkout-api' });
    expect(
      now.items.map((item) => [item.environment.key, item.release?.version, item.state]),
    ).toEqual([['dev', 'v2.0.0', 'idle']]);
  });

  it('rewinds to before the second deploy, from the snapshot', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const then = await read({ application: 'checkout-api', at: marks['afterV1'] ?? '' });
    expect(then.items[0]).toMatchObject({ release: { version: 'v1.0.0' }, state: 'idle' });
    const later = await read({ scope: 'commerce', at: marks['afterV2'] ?? '' });
    expect(later.items[0]).toMatchObject({ release: { version: 'v2.0.0' }, state: 'idle' });
    const before = await read({ scope: 'commerce', at: '2026-10-01T00:00:00Z' });
    expect(before.items).toEqual([]);
  });

  it('lists what changed in a scope and window, newest first', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    await harness.sql.begin((tx) =>
      recordChange(tx, {
        kind: 'config',
        summary: 'Config · checkout-api LOG_LEVEL to debug in dev',
        applicationId: f.app,
        environmentId: f.environments.dev,
        actorUserId: harness?.users.member ?? null,
        occurredAt: f.clock.now,
      }),
    );
    const body = changesResponseSchema.parse(
      (
        await http.get('/changes', harness.users.member, {
          scope: 'commerce',
          from: '2026-10-13T00:00:00Z',
          to: '2026-10-14T00:00:00Z',
        })
      ).json(),
    );
    expect(body.items.map((item) => item.kind)).toEqual(['config', 'deploy', 'deploy']);
    expect(body.items[1]?.summary).toBe('Deploy · checkout-api v2.0.0 to dev');
    expect(body.items[1]?.revertible).toBe(true);
    expect(body.counts).toEqual({ total: 3, prod: 0 });
    const deploysOnly = changesResponseSchema.parse(
      (
        await http.get('/changes', harness.users.member, {
          kinds: 'config',
          from: '2026-10-13T00:00:00Z',
          to: '2026-10-14T00:00:00Z',
        })
      ).json(),
    );
    expect(deploysOnly.items).toHaveLength(1);
    expect((await http.get('/changes', harness.users.outsider)).statusCode).toBe(403);
  });
});
