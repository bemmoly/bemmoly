import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  forYouSummarySchema,
  servicesResponseSchema,
  serviceVersionsResponseSchema,
} from '../../../../shared/service-views.ts';
import { seedDemo } from '../../../../scripts/demo/seed.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';

/*
 * Services, a service's versions and For you's summary, read over HTTP from a slice of the
 * demo: every service once, environments in path order, and an open change request showing
 * on the environment it moves a version into.
 */
describe('the services reads on the demo', () => {
  let harness: PipelinesHarness | undefined;
  let http: PipelinesHttp;
  let demo = '';
  let reason = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    const seeded = await seedDemo(harness.sql, { now: new Date(), scale: 0.1 });
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

  it('lists every service by domain with what runs in each environment', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const list = servicesResponseSchema.parse((await http.get('/services', demo)).json());
    const [count] = await harness.sql<{ n: number }[]>`
      select count(*)::int as n from pipeline_applications where archived_at is null`;
    expect(list.total).toBe(count?.n);
    expect(new Set(list.items.map((item) => item.key)).size).toBe(list.items.length);
    const positions = list.environments.map((environment) => environment.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(list.items.some((item) => item.running.length > 0)).toBe(true);
    const keys = new Set(list.environments.map((environment) => environment.key));
    expect(list.items.flatMap((item) => item.running).every((r) => keys.has(r.environment))).toBe(
      true,
    );
    const one = await http.get('/services', demo, { q: 'checkout-api' });
    expect(servicesResponseSchema.parse(one.json()).items.map((item) => item.key)).toContain(
      'checkout-api',
    );
  });

  it('shows an open change request on the environment it moves a version into', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const [target] = await harness.sql<
      { application_id: string; environment_id: string; key: string; release_id: string }[]
    >`
      select c.application_id, c.environment_id, e.key, rel.id as release_id
      from pipeline_current c
      join pipeline_applications a on a.id = c.application_id and a.key = 'checkout-api'
      join pipeline_environments e on e.id = c.environment_id
      join pipeline_releases rel on rel.application_id = c.application_id
      order by e.position desc, rel.created_at desc limit 1`;
    if (!target) throw new Error('The demo has no checkout-api in any environment');
    const [request] = await harness.sql<{ id: string; number: string }[]>`
      insert into pipeline_change_requests (environment_id, title, why, risk, status, requested_by)
      values (${target.environment_id}, 'Ship the new tax rules', 'Finance asked', 'medium',
        'waiting', ${demo}) returning id, number`;
    await harness.sql`
      insert into pipeline_change_request_items (change_request_id, application_id, release_id)
      values (${request!.id}, ${target.application_id}, ${target.release_id})`;
    await harness.sql`
      insert into pipeline_change_request_steps (change_request_id, position, group_name, count,
        condition, state)
      values (${request!.id}, 0, 'Approvers', 2, 'always', 'waiting')`;

    const list = servicesResponseSchema.parse(
      (await http.get('/services', demo, { q: 'checkout-api' })).json(),
    );
    const running = list.items
      .find((item) => item.key === 'checkout-api')
      ?.running.find((item) => item.environment === target.key);
    expect(running?.pending).toEqual({
      number: `CHG-${request!.number}`,
      status: 'waiting',
      approvals: 0,
      needed: 2,
    });

    const versions = serviceVersionsResponseSchema.parse(
      (await http.get('/services/checkout-api/versions', demo)).json(),
    );
    expect(versions.items.length).toBeGreaterThan(0);
    const carried = versions.items.find((item) => item.releaseId === target.release_id);
    expect(carried?.change?.number).toBe(`CHG-${request!.number}`);
    expect(versions.items.some((item) => item.runningIn.length > 0)).toBe(true);
    expect((await http.get('/services/no-such-service/versions', demo)).statusCode).toBe(404);

    const summary = forYouSummarySchema.parse((await http.get('/for-you/summary', demo)).json());
    expect(summary.lastEnvironment?.key).toBe(list.environments.at(-1)?.key);
    expect(
      summary.needsYou.some(
        (need) => need.kind === 'change_request' && need.number === `CHG-${request!.number}`,
      ),
    ).toBe(true);
    expect(summary.stats.deploysThisWeek).toBeGreaterThanOrEqual(0);
  });
});
