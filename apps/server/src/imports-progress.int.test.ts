import type { SqlClient } from '@bemmoly/core';
import type { ImportContainerPage, ImportJob } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness } from './boot-harness.ts';
import { startFakeSite, type FakeSite } from './imports/fake-atlassian.ts';
import { generateIssues, generateProjects } from './imports/generate.ts';
import { importCalls } from './imports/import-calls.ts';

/*
 * Progress per project and failures kept to one project, against the fake Jira site: one
 * project the source rate-limits for ever after its first page fails on its own while the
 * others finish (completed_with_errors), the overall bar never goes back, Retry carries that
 * project on from its checkpoint, every skipped record comes out as CSV, and the admin who
 * started the run hears in their Inbox.
 */

const PER_PROJECT = 6;

describe('Progress, partial failure and retry', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';
  let calls: ReturnType<typeof importCalls>;
  let sql: SqlClient;
  let site: FakeSite;
  let job: ImportJob;
  const { projects } = generateProjects(3);
  const issues = projects.flatMap((project, index) =>
    generateIssues(PER_PROJECT, project.key, 200_000 + index * 1000),
  );
  /** G2 answers its first page, then "too many requests" for ever. */
  const throttled = (path: string, url: URL) =>
    path.endsWith('/search/jql') &&
    (url.searchParams.get('jql') ?? '').includes('"G2"') &&
    url.searchParams.get('nextPageToken') !== null;

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
      projects,
      issues,
      pageSize: 2,
      rateLimitWhen: throttled,
    });
  });

  afterAll(async () => {
    await site?.close();
    await harness?.stop();
  });

  const issuesIn = async (key: string) =>
    (
      await sql<{ n: number }[]>`
        select count(*)::int as n from issues i join projects p on p.id = i.project_id
        where p.key = ${key}`
    )[0]!.n;

  it('lets one project fail on its own while the others finish, and the bar only grows', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    job = (await calls.connect('jira', site)).body;
    await calls.pick(
      job.id,
      projects.map((p) => p.id),
    );
    const started = await calls.call<ImportJob>('POST', `/admin/imports/${job.id}/run`);
    expect(started.status).toBe(200);
    const seen: number[] = [];
    let ended: ImportJob;
    for (;;) {
      const { body } = await calls.call<ImportJob>('GET', `/admin/imports/${job.id}`);
      seen.push(body.progress.done);
      if (body.status !== 'queued' && body.status !== 'running') {
        ended = body;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(ended.status, ended.error ?? '').toBe('completed_with_errors');
    expect(ended.progress.total).toBe(PER_PROJECT * 3);
    expect(ended.containers).toEqual({ total: 3, waiting: 0, running: 0, done: 2, failed: 1 });
    const rows = await calls.call<ImportContainerPage>(
      'GET',
      `/admin/imports/${job.id}/containers?filter=selected`,
    );
    const byKey = new Map(rows.body.items.map((row) => [row.key, row.progress]));
    expect(byKey.get('G1')).toMatchObject({
      status: 'done',
      done: PER_PROJECT,
      total: PER_PROJECT,
      path: '/work/board/G1',
      counts: { issues: { created: PER_PROJECT, updated: 0, skipped: 0 } },
    });
    expect(byKey.get('G2')).toMatchObject({
      status: 'failed',
      done: 2,
      total: PER_PROJECT,
      error: 'Jira kept answering “too many requests”',
    });
    expect(byKey.get('G3')?.status).toBe('done');
    expect([await issuesIn('G1'), await issuesIn('G2'), await issuesIn('G3')]).toEqual([
      PER_PROJECT,
      2,
      PER_PROJECT,
    ]);
  });

  it('tells the admin who started it in their Inbox', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const notes = await sql<{ kind: string; body: string; target_url: string | null }[]>`
      select n.kind, n.body, n.target_url from notifications n
      join users u on u.id = n.user_id where u.email = 'rohan@acmelabs.dev'
        and n.kind = 'import_finished'`;
    expect(notes).toHaveLength(1);
    expect(notes[0]!.body).toBe(
      '2 imported, 1 stopped: Jira kept answering “too many requests”. Retry carries on from where it stopped.',
    );
    expect(notes[0]!.target_url).toMatch(new RegExp(`/settings/import\\?job=${job.id}$`));
  });

  it('retries only the failed project, from where it stopped', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    site.options.rateLimitWhen = undefined;
    const g2 = projects[1]!.id;
    const before = site.requests.length;
    const started = await calls.call<ImportJob>('POST', `/admin/imports/${job.id}/run`, {
      containers: [g2],
    });
    expect(started.status, JSON.stringify(started.body)).toBe(200);
    const done = await calls.settle(job.id);
    expect(done.status, done.error ?? '').toBe('completed');
    expect(done.containers).toMatchObject({ done: 3, failed: 0 });
    const asked = site.requests.slice(before).filter((r) => r.endsWith('/search/jql'));
    expect(asked).toHaveLength(2);
    expect([await issuesIn('G1'), await issuesIn('G2'), await issuesIn('G3')]).toEqual([
      PER_PROJECT,
      PER_PROJECT,
      PER_PROJECT,
    ]);
    const retried = await calls.call('POST', `/admin/imports/${job.id}/run`, {
      containers: [projects[0]!.id],
    });
    expect(retried.status).toBe(400);
  });
});

describe('Skipped records as CSV', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';
  let calls: ReturnType<typeof importCalls>;
  let site: FakeSite;
  let app: Awaited<ReturnType<BootHarness['boot']>>;

  beforeAll(async () => {
    const started = await startBootHarness();
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
    app = await harness.boot('', { BEMMOLY_ALLOW_PRIVATE_URLS: 'true' });
    calls = importCalls(app);
    await calls.call('POST', '/admin/modules/work/enable', { access: { mode: 'everyone' } });
    site = await startFakeSite({ kind: 'jira-cloud' });
  });

  afterAll(async () => {
    await site?.close();
    await harness?.stop();
  });

  it('lists every skipped record the report counts', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const created = await calls.connect('jira', site);
    await calls.pick(created.body.id, ['10000']);
    const done = await calls.run(created.body.id);
    expect(done.status, done.error ?? '').toBe('completed');
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/imports/${created.body.id}/skips.csv`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/csv/);
    const lines = response.body.trimEnd().split('\r\n');
    expect(lines[0]).toBe('Project or space,Kind,Record,Reason');
    expect(lines).toHaveLength(done.report.skippedTotal + 1);
    // Links are written across projects after them, so their project column is empty.
    expect(lines).toContain(',link,OPS-2,It links to an issue that was not imported');
  });
});

describe('A run of more projects than one page holds', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';
  let calls: ReturnType<typeof importCalls>;
  let site: FakeSite;
  const { projects } = generateProjects(120);
  const late = projects[114]!;

  beforeAll(async () => {
    const started = await startBootHarness();
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
    const app = await harness.boot('', { BEMMOLY_ALLOW_PRIVATE_URLS: 'true' });
    calls = importCalls(app);
    await calls.call('POST', '/admin/modules/work/enable', { access: { mode: 'everyone' } });
    site = await startFakeSite({
      kind: 'jira-cloud',
      projects,
      issues: generateIssues(3, late.key, 300_000),
      rateLimitWhen: (path, url) =>
        path.endsWith('/search/jql') &&
        (url.searchParams.get('jql') ?? '').includes(`"${late.key}"`),
    });
  });

  afterAll(async () => {
    await site?.close();
    await harness?.stop();
  });

  it('lists the failed project apart, and the rest a page at a time', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const job = (await calls.connect('jira', site)).body;
    await calls.pick(
      job.id,
      projects.map((p) => p.id),
    );
    const done = await calls.run(job.id);
    expect(done.status, done.error ?? '').toBe('completed_with_errors');
    expect(done.containers).toMatchObject({ total: 120, done: 119, failed: 1 });
    const failed = await calls.containers(job.id, 'filter=failed');
    expect(failed.body.items.map((row) => row.key)).toEqual([late.key]);
    const first = await calls.containers(job.id, 'filter=others&limit=100');
    expect(first.body.items).toHaveLength(100);
    expect(first.body.view.total).toBe(119);
    const second = await calls.containers(
      job.id,
      `filter=others&limit=100&cursor=${first.body.next}`,
    );
    expect(second.body.items).toHaveLength(19);
    expect(second.body.next).toBeNull();
    const others = [...first.body.items, ...second.body.items];
    expect(others.every((row) => row.progress?.status === 'done')).toBe(true);
    expect(others.map((row) => row.key)).not.toContain(late.key);
  });
});
