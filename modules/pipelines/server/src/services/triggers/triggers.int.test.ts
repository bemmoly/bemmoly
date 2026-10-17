import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedCatalogFixture } from '../../testing/fixture.ts';
import { createPool, givePipeline } from '../../testing/execution.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { refreshSchedules } from './schedules.ts';

const SIMPLE = {
  checkout: false,
  test: [{ name: 'Unit', run: 'pnpm test' }],
  schedules: [{ cron: '0 3 * * *', timeZone: 'Asia/Kolkata' }],
};

const push = (after: string, files: string[], branch = 'main') => ({
  type: 'push' as const,
  repository: 'acme/checkout',
  occurredAt: new Date().toISOString(),
  push: {
    branch,
    before: '0'.repeat(40),
    after,
    defaultBranch: 'main',
    isDefaultBranch: branch === 'main',
    created: false,
    deleted: false,
    forced: false,
    changedFiles: files,
    truncated: false,
    commits: 1,
    pusher: 'priya',
  },
});

const pr = (action: string, headSha: string) => ({
  type: 'pull_request' as const,
  repository: 'acme/checkout',
  action,
  number: 42,
  title: 'Retry UPI collect',
  url: 'https://example.test/pr/42',
  headSha,
  headRef: 'feat/upi',
  baseRef: 'main',
  fromFork: false,
  draft: false,
  merged: false,
  author: 'priya',
  occurredAt: new Date().toISOString(),
});

describe('triggers', () => {
  let harness: PipelinesHarness | undefined;
  let reason = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    await seedCatalogFixture(harness.sql, harness.users.member);
    await createPool(harness.sql, 'linux-x64');
    await givePipeline(harness.sql, 'checkout-api', SIMPLE);
    await harness.sql`update pipeline_applications set path = 'services/api' where key = 'checkout-api'`;
  });

  afterAll(async () => {
    await harness?.stop();
  });

  it('starts one run per pushed commit that touches the application, once', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { triggers } = harness.services;
    expect(await triggers.push(push('a'.repeat(40), ['docs/readme.md']))).toBeNull();
    const first = await triggers.push(push('b'.repeat(40), ['services/api/src/pay.ts']));
    expect(first).not.toBeNull();
    expect(await triggers.push(push('b'.repeat(40), ['services/api/src/pay.ts']))).toBe(first);
    const [run] = await harness.sql<{ trigger: string; priority_class: string; ref: string }[]>`
      select trigger, priority_class, ref from pipeline_runs where id = ${first ?? ''}`;
    expect(run).toEqual({ trigger: 'push', priority_class: 'main', ref: 'main' });
  });

  it('supersedes an older run of a pull request and cancels it when the request closes', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { triggers } = harness.services;
    const sql = harness.sql;
    const older = await triggers.pullRequest(pr('opened', 'c'.repeat(40)));
    const newer = await triggers.pullRequest(pr('synchronize', 'd'.repeat(40)));
    const states = async () =>
      sql<{ id: string; state: string; superseded_by_run_id: string | null }[]>`
        select id, state, superseded_by_run_id from pipeline_runs
        where pull_request = 42 order by id`;
    expect(await states()).toEqual([
      { id: older, state: 'cancelled', superseded_by_run_id: newer },
      { id: newer, state: 'queued', superseded_by_run_id: null },
    ]);
    expect(await triggers.pullRequest(pr('labeled', 'd'.repeat(40)))).toBeNull();
    await triggers.pullRequest(pr('closed', 'd'.repeat(40)));
    expect((await states()).map((run) => run.state)).toEqual(['cancelled', 'cancelled']);
  });

  it('starts a scheduled run when its time comes, in its time zone', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const { sql, services } = harness;
    const [app] = await sql<
      { id: string }[]
    >`select id from pipeline_applications where key = 'checkout-api'`;
    const now = new Date('2026-10-17T00:00:00Z');
    expect(await refreshSchedules(sql, app?.id ?? '', now)).toBe(1);
    const [schedule] = await sql<
      { next_run_at: Date }[]
    >`select next_run_at from pipeline_schedules`;
    // 03:00 in Kolkata is 21:30 UTC the day before.
    expect(new Date(schedule?.next_run_at ?? 0).toISOString()).toBe('2026-10-17T21:30:00.000Z');
    expect(await services.triggers.runDueSchedules(new Date('2026-10-17T21:00:00Z'))).toBe(0);
    expect(await services.triggers.runDueSchedules(new Date('2026-10-17T21:30:30Z'))).toBe(1);
    const [run] = await sql<{ trigger: string; priority_class: string }[]>`
      select trigger, priority_class from pipeline_runs where trigger = 'schedule'`;
    expect(run).toEqual({ trigger: 'schedule', priority_class: 'scheduled' });
    const pipeline = await services.runs.pipeline(harness.as(harness.users.member), 'checkout-api');
    expect(pipeline.schedules[0]).toMatchObject({
      cron: '0 3 * * *',
      nextRunAt: '2026-10-18T21:30:00.000Z',
    });
  });
});
