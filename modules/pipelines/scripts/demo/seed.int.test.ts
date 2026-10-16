import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPipelinesHarness, type PipelinesHarness } from '../../server/src/testing/harness.ts';
import { seedDemo } from './seed.ts';

describe('the Acme demo seed', () => {
  let harness: PipelinesHarness | undefined;
  let reason = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (started.available) harness = started.harness;
    else reason = started.reason;
  });

  afterAll(async () => harness?.stop());

  it('draws the same small Acme every time and every read endpoint answers from it', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const now = new Date('2026-10-16T08:30:00Z');
    const { demo } = await seedDemo(harness.sql, { now, scale: 0.05 });
    const counts = await harness.sql<{ table: string; count: number }[]>`
      select 'domains' as table, count(*)::int from pipeline_domains
      union all select 'environments', count(*)::int from pipeline_environments
      union all select 'applications', count(*)::int from pipeline_applications
      union all select 'runs', count(*)::int from pipeline_runs
      union all select 'deployments', count(*)::int from pipeline_deployments
      union all select 'current', count(*)::int from pipeline_current`;
    const byTable = Object.fromEntries(counts.map((row) => [row.table, row.count]));
    expect(byTable['domains']).toBe(9);
    expect(byTable['environments']).toBe(5);
    expect(byTable['applications']).toBeGreaterThan(40);
    expect(byTable['runs']).toBeGreaterThan(100);
    expect(byTable['deployments']).toBeGreaterThan(50);
    await harness.sql`
      insert into module_grants (module_id, subject_kind, subject_id)
      values ('pipelines', 'user', ${demo.id}) on conflict do nothing`;
    const as = harness.as(demo.id);
    const page = await harness.services.catalog.applications(as, { limit: 50, sort: 'name' });
    expect(page.total).toBe(byTable['applications']);
    expect(page.items.some((application) => application.delivery.prodVersion !== null)).toBe(true);
    const facets = await harness.services.catalog.facets(as, {});
    expect(facets.domain).toHaveLength(9);
    const overview = await harness.services.overview.get(as, {});
    expect(overview.live.running).toBeGreaterThan(0);
    expect(overview.catalog.domains).toBe(9);
  });
});
