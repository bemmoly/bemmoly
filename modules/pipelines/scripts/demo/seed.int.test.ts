import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDiskObjectStore, createModuleObjects } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createChunkStore } from '../../server/src/services/logs/store.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../server/src/testing/harness.ts';
import { seedDemo } from './seed.ts';

describe('the Acme demo seed', () => {
  let harness: PipelinesHarness | undefined;
  let reason = '';
  let dir = '';

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pipelines-seed-'));
    const started = await startPipelinesHarness();
    if (started.available) harness = started.harness;
    else reason = started.reason;
  });

  afterAll(async () => {
    await harness?.stop();
    await rm(dir, { recursive: true, force: true });
  });

  it('draws the same small Acme every time and every read endpoint answers from it', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const now = new Date('2026-10-16T08:30:00Z');
    const objects = createModuleObjects('pipelines', () => createDiskObjectStore({ root: dir }));
    const { demo } = await seedDemo(harness.sql, { now, scale: 0.05, objects });
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

    // A failing test shard has its log, ending on the test its report marks failed.
    const [failing] = await harness.sql<{ job_id: string; name: string; failure_line: string }[]>`
      select j.id as job_id, t.name, j.failure_line
      from pipeline_test_failures f
      join pipeline_tests t on t.id = f.test_id
      join pipeline_jobs j on j.id = f.job_id
      where j.state = 'failed' order by j.id limit 1`;
    expect(failing?.failure_line).toMatch(/FAIL/);
    const chunks = await harness.sql<{ object_key: string; has_error: boolean }[]>`
      select object_key, has_error from pipeline_log_chunks
      where job_id = ${failing?.job_id ?? null}::uuid order by seq`;
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.some((chunk) => chunk.has_error)).toBe(true);
    const store = createChunkStore(objects);
    const lines = (await Promise.all(chunks.map((c) => store.read(c.object_key)))).flat();
    expect(lines.length).toBeGreaterThan(10);
    expect(lines.some((line) => line.includes(failing?.name ?? '?'))).toBe(true);
  });
});
