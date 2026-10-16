import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { insightsSchema } from '../../../../shared/insights.ts';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { startPipelinesHttp, type PipelinesHttp } from '../../testing/http.ts';

describe('insights endpoint', () => {
  let harness: PipelinesHarness | undefined;
  let http: PipelinesHttp;
  let reason = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    const fixture = await seedCatalogFixture(harness.sql, harness.users.member);
    const checkout = fixture.applications['checkout-api'] ?? '';
    // A bad Prod deploy two days ago, rolled back 40 minutes after it started.
    await harness.sql`
      with prod as (select id from pipeline_environments where key = 'prod-asia-south1'),
        release as (select id from pipeline_releases where application_id = ${checkout}),
        bad as (
          insert into pipeline_deployments
            (release_id, application_id, environment_id, state, started_at, finished_at)
          select release.id, ${checkout}, prod.id, 'rolled_back',
            now() - interval '2 days', now() - interval '2 days' + interval '40 minutes'
          from prod, release returning id, release_id, environment_id)
      insert into pipeline_deployments (release_id, application_id, environment_id, kind,
        state, rollback_of_id, started_at, finished_at)
      select release_id, ${checkout}, environment_id, 'rollback', 'succeeded', id,
        now() - interval '2 days' + interval '35 minutes',
        now() - interval '2 days' + interval '40 minutes'
      from bad`;
    http = await startPipelinesHttp(harness);
  });

  afterAll(async () => {
    await http?.app.close();
    await harness?.stop();
  });

  const member = () => harness?.users.member ?? '';

  it('measures the organisation over the days that have history, by domain', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const body = insightsSchema.parse(
      (await http.get('/insights', member(), { range: '30d' })).json(),
    );
    expect(body.range).toBe('30d');
    // Seven days of rollups: two Prod deploys a day, one failure, 9600 s lead time.
    expect(body.measures.deployFrequency.value).toBeCloseTo(2);
    expect(body.measures.changeFailureRate.value).toBeCloseTo(1 / 14);
    expect(body.measures.leadTime.value).toBe(9600);
    expect(body.measures.timeToRestore.value).toBe(2400);
    expect(body.measures.leadTime.previous).toBeNull();
    expect(body.measures.deployFrequency.weeks.length).toBeGreaterThan(0);
    expect(body.rows.map((row) => [row.kind, row.key, row.prodDeploys])).toEqual([
      ['domain', 'commerce', 14],
      ['domain', 'data', 0],
    ]);
    expect(body.rows[0]?.color).toBe('epic-1');
    expect(body.rows[1]?.changeFailureRate).toBeNull();
  });

  it('breaks a domain into its groups and a group into its owning teams', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const commerce = insightsSchema.parse(
      (await http.get('/insights', member(), { scope: 'commerce' })).json(),
    );
    expect(commerce.rows.map((row) => [row.kind, row.key])).toEqual([
      ['group', 'checkout'],
      ['group', 'pricing'],
    ]);
    const checkout = insightsSchema.parse(
      (await http.get('/insights', member(), { scope: 'commerce/checkout' })).json(),
    );
    expect(checkout.rows.map((row) => [row.kind, row.name, row.applications])).toEqual([
      ['team', 'Payments', 2],
    ]);
    const teams = insightsSchema.parse(
      (await http.get('/insights', member(), { by: 'team' })).json(),
    );
    expect(teams.rows.map((row) => row.name)).toEqual(['Payments', 'Search']);
  });

  it('refuses a scope or range it does not know', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    expect((await http.get('/insights', member(), { scope: 'nope' })).statusCode).toBe(404);
    expect((await http.get('/insights', member(), { range: '2y' })).statusCode).toBe(400);
  });
});
