import type { SqlClient } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness } from './boot-harness.ts';
import { startFakeSite, type FakeSite } from './imports/fake-atlassian.ts';
import { generateIssues } from './imports/generate.ts';
import { importCalls } from './imports/import-calls.ts';

/*
 * The 0.6 exit criterion in miniature: a large Jira project from a local fake site, imported
 * through the queue, timed from Run to completed. CI runs 500 issues to keep the path honest;
 * BEMMOLY_IMPORT_PERF_ISSUES=10000 runs the full size, which must finish in under 30 minutes.
 * The measured time is attached to the test result.
 */

const COUNT = Number(process.env['BEMMOLY_IMPORT_PERF_ISSUES'] ?? 500);
const BUDGET_MS = 30 * 60 * 1000;

describe('Jira import at size', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';
  let calls: ReturnType<typeof importCalls>;
  let sql: SqlClient;
  let site: FakeSite;

  beforeAll(async () => {
    const started = await startBootHarness();
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
    const app = await harness.boot('', { BEMMOLY_ALLOW_PRIVATE_URLS: 'true' });
    calls = importCalls(app);
    sql = app.instance.database!.sql;
    await calls.call('POST', '/admin/modules/work/enable', { access: { mode: 'everyone' } });
    site = await startFakeSite({
      kind: 'jira-cloud',
      issues: generateIssues(COUNT),
      pageSize: 100,
    });
  });

  afterAll(async () => {
    await site?.close();
    await harness?.stop();
  });

  it(`imports ${COUNT} issues within the budget`, { timeout: BUDGET_MS + 60_000 }, async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const created = await calls.connect('jira', site);
    await calls.pick(created.body.id, ['10000']);
    const started = performance.now();
    await calls.call('POST', `/admin/imports/${created.body.id}/run`);
    const done = await calls.settle(created.body.id, BUDGET_MS);
    const seconds = (performance.now() - started) / 1000;
    expect(done.status, done.error ?? '').toBe('completed');
    const [{ count } = { count: 0 }] = await sql<
      { count: number }[]
    >`select count(*)::int as count from issues`;
    expect(count).toBe(COUNT);
    const [{ comments } = { comments: 0 }] = await sql<
      { comments: number }[]
    >`select count(*)::int as comments from comments`;
    expect(comments).toBe(COUNT * 2);
    expect(seconds * 1000).toBeLessThan(BUDGET_MS);
    await ctx.annotate(
      `${COUNT} issues, ${COUNT * 2} comments, ${COUNT - 1} links: ${seconds.toFixed(1)} s (${Math.round(COUNT / seconds)} issues/s)`,
      'notice',
    );
  });
});
