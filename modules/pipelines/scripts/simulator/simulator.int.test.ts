import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPipelinesHarness, type PipelinesHarness } from '../../server/src/testing/harness.ts';
import { notifyPayloadSchema, PIPELINES_NOTIFY_CHANNEL } from '../../shared/streams.ts';
import { seedDemo } from '../demo/seed.ts';
import { createSimulator } from './index.ts';

describe('the demo simulator', () => {
  let harness: PipelinesHarness | undefined;
  let reason = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (started.available) harness = started.harness;
    else reason = started.reason;
  });

  afterAll(async () => harness?.stop());

  it('keeps the seeded demo moving and tells live viewers about every move', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { sql } = harness;
    const start = new Date();
    await seedDemo(sql, { now: start, scale: 0.05 });
    // The simulator's clock starts after the seed, so anything it moves is newer than this.
    const moved = new Date(Date.now() + 1000);
    const counts = async () => {
      const [row] = await sql<
        { runs: number; finished: number; events: number; current: number; promotions: number }[]
      >`
        select
          (select count(*) from pipeline_runs where created_at >= ${start.toISOString()}::timestamptz)::int
            as runs,
          (select count(*) from pipeline_jobs where state in ('passed', 'failed')
            and finished_at >= ${start.toISOString()}::timestamptz)::int as finished,
          (select count(*) from pipeline_deployment_events
            where occurred_at >= ${start.toISOString()}::timestamptz)::int as events,
          (select count(*) from pipeline_current
            where updated_at > ${moved.toISOString()}::timestamptz)::int as current,
          (select count(*) from pipeline_promotions where plan->>'simulator' = 'true')::int
            as promotions`;
      return row ?? { runs: 0, finished: 0, events: 0, current: 0, promotions: 0 };
    };
    const before = await counts();

    const heard: { topic: string; kind: string }[] = [];
    const listener = await sql.listen(PIPELINES_NOTIFY_CHANNEL, (text) => {
      const parsed = notifyPayloadSchema.safeParse(JSON.parse(text));
      if (parsed.success) heard.push({ topic: parsed.data.topic, kind: parsed.data.kind });
    });
    // Five simulated seconds a tick: 400 ticks are about half an hour of a working morning.
    let clock = moved.getTime();
    const simulator = await createSimulator(sql, { seed: 7, now: () => new Date(clock) });
    const kinds = new Set<string>();
    const errors: string[] = [];
    for (let i = 0; i < 400; i += 1) {
      clock += 5000;
      const result = await simulator.tick();
      if (result.error) errors.push(`${result.action.kind}: ${String(result.error)}`);
      if (result.applied) kinds.add(result.action.kind);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    await listener.unlisten();

    expect(errors).toEqual([]);
    expect(simulator.state.runs.length).toBeLessThanOrEqual(simulator.limits.runs);
    const after = await counts();
    expect(after.runs).toBeGreaterThan(before.runs);
    expect(after.finished).toBeGreaterThan(before.finished);
    expect(after.events).toBeGreaterThan(before.events);
    expect(after.current).toBeGreaterThan(before.current);
    expect(after.promotions).toBeGreaterThan(0);
    for (const kind of ['run.start', 'job.finish', 'deployment.step', 'promotion.request'])
      expect(kinds, kind).toContain(kind);

    const topics = new Set(heard.map((e) => `${e.topic.split(':')[0]}/${e.kind}`));
    for (const expected of [
      'live/run.updated',
      'live/counter',
      'run/job.updated',
      'map/map.cell',
      'application/deployment.updated',
      'application/current.updated',
      'application/promotion.updated',
      'for-you/for-you.changed',
      'capacity/capacity.updated',
      'job/log.appended',
    ]) {
      expect(topics, expected).toContain(expected);
    }

    // The map still rewinds: every deployment the simulator moved left its events.
    const [orphans] = await sql<{ count: number }[]>`
      select count(*)::int as count from pipeline_current c
      where c.updated_at >= ${start.toISOString()}::timestamptz and c.deployment_id is not null
        and not exists (select 1 from pipeline_deployment_events e
          where e.deployment_id = c.deployment_id)`;
    expect(orphans?.count).toBe(0);
  });
});
