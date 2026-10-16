import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { environmentStripSchema } from '../../../../shared/deployments.ts';
import { forYouSchema } from '../../../../shared/for-you.ts';
import { mapSchema } from '../../../../shared/map.ts';
import { seedDemo } from '../../../../scripts/demo/seed.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';

/*
 * For you, the Release map (live and rewound) and the environment strip, read over HTTP from
 * a third of the Acme demo (the harness keeps its statement timeout, which the whole demo's rollups outlast; the full demo answers faster than these bounds on a laptop).
 */
describe('For you, the map and the environment strip on the Acme demo', () => {
  let harness: PipelinesHarness | undefined;
  let http: PipelinesHttp;
  let demo = '';
  let reason = '';
  const now = new Date();

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    const seeded = await seedDemo(harness.sql, { now, scale: 0.3 });
    demo = seeded.demo.id;
    await harness.sql`
      insert into module_grants (module_id, subject_kind, subject_id)
      values ('pipelines', 'user', ${demo}) on conflict do nothing`;
    http = await startPipelinesHttp(harness);
  });

  afterAll(async () => {
    await http?.app.close();
    await harness?.stop();
  });

  /** The 95th percentile of twenty reads, after one to warm the plan cache. */
  async function p95(path: string, query: (index: number) => Record<string, string> = () => ({})) {
    await http.get(path, demo, query(0));
    const times: number[] = [];
    for (let index = 1; index <= 20; index += 1) {
      const started = performance.now();
      const response = await http.get(path, demo, query(index));
      times.push(performance.now() - started);
      expect(response.statusCode).toBe(200);
    }
    return times.sort((a, b) => a - b)[18] ?? Infinity;
  }

  it('draws the organisation by domain, live, with every application counted once', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const map = mapSchema.parse((await http.get('/map', demo)).json());
    expect(map.live).toBe(true);
    expect(map.rows.map((row) => row.kind)).toEqual(map.rows.map(() => 'domain'));
    expect(map.rows.reduce((sum, row) => sum + row.count, 0)).toBe(map.totals.applications);
    expect(map.columns[0]?.kind).toBe('build');
    expect(map.columns.filter((column) => column.kind === 'environment')).toHaveLength(5);
    expect(map.timeline).toHaveLength(96);
    const cells = map.rows.flatMap((row) => row.cells);
    expect(cells.some((cell) => cell.running > 0)).toBe(true);
    expect(cells.some((cell) => cell.canary > 0)).toBe(true);
    expect(cells.every((cell) => cell.dots.length <= 12)).toBe(true);
  });

  it('zooms to a domain and a group, and rewinds to an earlier moment', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const domain = mapSchema.parse((await http.get('/map', demo, { scope: 'commerce' })).json());
    expect(
      domain.rows.every((row) => row.kind === 'group' && row.zoomTo?.startsWith('commerce/')),
    ).toBe(true);
    const group = mapSchema.parse(
      (await http.get('/map', demo, { scope: domain.rows[0]?.zoomTo ?? '' })).json(),
    );
    expect(group.rows.every((row) => row.kind === 'application' && row.zoomTo === null)).toBe(true);
    const at = new Date(now.getTime() - 6 * 3600_000).toISOString();
    const rewound = mapSchema.parse((await http.get('/map', demo, { at })).json());
    expect(rewound.live).toBe(false);
    expect(rewound.at).toBe(at);
    const live = mapSchema.parse((await http.get('/map', demo)).json());
    const placed = (map: typeof live) =>
      map.rows.flatMap((row) => row.cells).reduce((sum, cell) => sum + cell.total, 0);
    expect(placed(rewound)).toBeLessThanOrEqual(placed(live));
  });

  it("lists the demo person's changes, approvals, teams and on-call", async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const forYou = forYouSchema.parse((await http.get('/for-you', demo)).json());
    const titles = forYou.journeys.map((journey) => journey.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        'Retry UPI collect on gateway timeout',
        'Cache tax rules per region',
        'Add idempotency key to refunds',
      ]),
    );
    const canary = forYou.journeys.find((journey) => journey.title.startsWith('Retry UPI'));
    expect(canary?.stations.find((station) => station.live)?.detail).toBe('25% canary');
    const failing = forYou.journeys.find((journey) => journey.title.startsWith('Add idempotency'));
    expect(failing?.note.action).toBe('rerun_failed');
    expect(failing?.note.flag).toBe('Failed 3 of last 50 on main');
    expect(forYou.waitingForMe.length).toBeGreaterThanOrEqual(2);
    expect(forYou.myTeams.some((team) => team.mainState === 'broken')).toBe(true);
    // The demo's shift runs 12 hours up to 18:00, so at night there is none to show.
    const [shift] = await harness.sql<{ active: boolean }[]>`
      select exists (select 1 from pipeline_oncall where user_id = ${demo}::uuid
        and starts_at <= now() and ends_at > now()) as active`;
    expect(forYou.onCall?.label ?? null).toBe(shift?.active ? 'Payments primary' : null);
  });

  it("draws checkout-api's environments with the canary and the next wave", async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const strip = environmentStripSchema.parse(
      (await http.get('/applications/checkout-api/environments', demo)).json(),
    );
    const asia = strip.items.find((item) => item.environment.key === 'prod-asia-south1');
    expect(asia).toMatchObject({ state: 'canary', movingVersion: 'v1.43.0', trafficPercent: 25 });
    expect(asia?.deploymentId).not.toBeNull();
    const us = strip.items.find((item) => item.environment.key === 'prod-us-east1');
    expect(us?.nextWave?.after).toBe('asia');
    expect((await http.get('/applications/no-such-app/environments', demo)).statusCode).toBe(404);
  });

  it('answers each read in well under 100 ms at the 95th percentile', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const hours = (index: number) => ({
      at: new Date(now.getTime() - (index + 1) * 3600_000).toISOString(),
    });
    const timings = {
      map: await p95('/map'),
      domain: await p95('/map', () => ({ scope: 'commerce' })),
      rewind: await p95('/map', hours),
      forYou: await p95('/for-you'),
      strip: await p95('/applications/checkout-api/environments'),
    };
    for (const value of Object.values(timings)) expect(value).toBeLessThan(100);
  });
});
