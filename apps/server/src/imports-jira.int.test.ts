import type { SqlClient } from '@bemmoly/core';
import type { ImportJob, ImportSource } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness } from './boot-harness.ts';
import { FIXTURE_TOKEN, startFakeSite, type FakeSite } from './imports/fake-atlassian.ts';
import { importCalls } from './imports/import-calls.ts';

/*
 * The Jira importer on the real boot path, against a local fake site serving hand-written
 * fixtures: discovery, plan, a run through the pg-boss queue, what lands in Work's tables,
 * a re-run that updates instead of duplicating, and a run that fails half way and resumes.
 */

describe('Jira import', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';
  let calls: ReturnType<typeof importCalls>;
  let sql: SqlClient;
  let site: FakeSite;
  let job: ImportJob;

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
      rateLimitOnce: new Set(['/rest/api/3/field']),
    });
  });

  afterAll(async () => {
    await site?.close();
    await harness?.stop();
  });

  it('offers the sources of the enabled modules', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { body } = await calls.call<{ items: ImportSource[] }>('GET', '/admin/import-sources');
    const ids = body.items.map((source) => source.id);
    expect(ids).toEqual(expect.arrayContaining(['jira', 'csv']));
    expect(ids).not.toContain('confluence');
    const jira = body.items.find((source) => source.id === 'jira')!;
    expect(jira.fields.find((field) => field.name === 'token')?.kind).toBe('secret');
  });

  it('refuses a wrong token with a message the admin can act on', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const refused = await calls.call('POST', '/admin/imports', {
      source: 'jira',
      values: { deployment: 'cloud', url: site.url, email: 'rohan@acmelabs.dev', token: 'wrong' },
    });
    expect(refused.status).toBe(400);
    expect(refused.body['message']).toMatch(/refused the credentials/);
  });

  it('discovers projects with counts and keeps the token write-only', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const created = await calls.connect('jira', site);
    expect(created.status).toBe(201);
    job = created.body;
    expect(job.discovery?.containers.map((c) => [c.key, c.count])).toEqual([
      ['OPS', 5],
      ['MKT', 0],
    ]);
    expect(job.connection).toEqual({
      deployment: 'cloud',
      url: site.url,
      email: 'rohan@acmelabs.dev',
      token: true,
    });
    expect(JSON.stringify(job)).not.toContain(FIXTURE_TOKEN);
    const [row] = await sql<{ credentials: string; connection: unknown }[]>`
      select credentials, connection from import_jobs where id = ${job.id}`;
    expect(row!.credentials).not.toContain(FIXTURE_TOKEN);
    expect(JSON.stringify(row!.connection)).not.toContain(FIXTURE_TOKEN);
  });

  it('plans how types, statuses and fields land', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const planned = await calls.pick(job.id, ['10000']);
    expect(planned.status).toBe(200);
    const plan = planned.body.plan!;
    expect(plan.counts).toEqual({ projects: 1, issues: 5 });
    const find = (kind: string, source: string) =>
      plan.mappings.find((m) => m.kind === kind && m.source === source);
    expect(find('project', 'OPS')?.action).toBe('create');
    expect(find('status', 'In Progress')?.action).toBe('match');
    expect(find('status', 'To Do')?.action).toBe('create');
    expect(find('issue_type', 'Spike')).toMatchObject({
      target: 'Story',
      note: 'Matched by level',
    });
    expect(find('field', 'Severity')?.action).toBe('match');
    expect(find('field', 'Customer tier')?.action).toBe('create');
    expect(find('field', 'Team')?.action).toBe('report');
  });

  it('runs as a job and writes projects, issues and everything on them', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const done = await calls.run(job.id);
    expect(done.status, done.error ?? '').toBe('completed');
    expect(done.report.counts['issues']).toEqual({ created: 5, updated: 0, skipped: 0 });
    const issues = await sql<
      {
        key: string;
        status: string;
        parent: string | null;
        sprint: string | null;
        estimate: string | null;
        priority: string;
        custom_fields: Record<string, unknown>;
      }[]
    >`
      select i.key, s.name as status, p.key as parent, sp.name as sprint, i.estimate::text,
        i.priority, i.custom_fields
      from issues i join workflow_statuses s on s.id = i.status_id
      left join issues p on p.id = i.parent_id left join sprints sp on sp.id = i.sprint_id
      order by i.number`;
    expect(issues.map((i) => [i.key, i.status, i.parent])).toEqual([
      ['OPS-1', 'In progress', null],
      ['OPS-2', 'In Review', 'OPS-1'],
      ['OPS-3', 'To Do', null],
      ['OPS-5', 'Done', 'OPS-2'],
      ['OPS-6', 'To Do', null],
    ]);
    expect(issues[1]).toMatchObject({ sprint: 'Sprint 2', estimate: '5.00', priority: 'medium' });
    expect(issues[1]!.custom_fields).toEqual({ severity: 'sev1' });
    expect(issues[0]!.custom_fields).toEqual({ customer_tier: 'gold' });
    expect(issues[2]!.custom_fields).toEqual({ release_notes: 'Fixed in 2.1' });
    const [counter] = await sql<{ next_number: number }[]>`
      select c.next_number from project_counters c join projects p on p.id = c.project_id
      where p.key = 'OPS'`;
    expect(counter!.next_number).toBe(7);
    expect(await sql`select 1 from comments`).toHaveLength(4);
    const [attachment] = await sql<
      { filename: string; size: string }[]
    >`select filename, size::text from attachments`;
    expect(attachment).toEqual({ filename: 'diagram.png', size: '16' });
    expect(await sql`select 1 from issue_links where kind = 'blocks'`).toHaveLength(1);
    expect((await sql`select name from labels order by name`).map((r) => r['name'])).toEqual([
      'bug',
      'payments',
      'research',
      'security',
    ]);
    expect(
      await sql`select 1 from boards b join projects p on p.id = b.project_id where p.key = 'OPS' and b.name = 'OPS board'`,
    ).toHaveLength(1);
    const people = await sql<
      { email: string; status: string }[]
    >`select email, status from users order by email`;
    expect(people.find((p) => p.email === 'ada@example.test')?.status).toBe('invited');
    expect(people.find((p) => p.email.endsWith('@placeholder.invalid'))?.status).toBe(
      'deactivated',
    );
    expect(people.filter((p) => p.email === 'rohan@acmelabs.dev')).toHaveLength(1);
    const [description] = await sql<
      { description: unknown }[]
    >`select description from issues where key = 'OPS-1'`;
    expect(JSON.stringify(description!.description)).toContain(
      '"type":"issueEmbed","attrs":{"key":"OPS-2"}',
    );
    expect(JSON.stringify(description!.description)).toContain('"type":"unsupportedBlock"');
    expect(done.report.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'field', source: 'Team' }),
        expect.objectContaining({
          kind: 'link',
          source: 'OPS-2',
          reason: 'It links to an issue that was not imported',
        }),
      ]),
    );
  });

  it('updates on a re-run instead of duplicating, and leaves local edits alone', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const downloads = site.requests.filter((r) => r.includes('/attachment/content/')).length;
    await sql`update issues set title = 'Edited here', updated_at = now() + interval '1 minute' where key = 'OPS-3'`;
    const again = await calls.run(job.id);
    expect(again.status).toBe('completed');
    expect(again.runs).toBe(2);
    expect(again.report.counts['issues']).toEqual({ created: 0, updated: 4, skipped: 1 });
    expect(await sql`select 1 from issues`).toHaveLength(5);
    expect(await sql`select 1 from comments`).toHaveLength(4);
    expect(await sql`select 1 from attachments`).toHaveLength(1);
    expect(await sql`select 1 from projects where key = 'OPS'`).toHaveLength(1);
    expect(site.requests.filter((r) => r.includes('/attachment/content/')).length).toBe(downloads);
    const [kept] = await sql<{ title: string }[]>`select title from issues where key = 'OPS-3'`;
    expect(kept!.title).toBe('Edited here');
    expect(again.report.skipped).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'issue', source: 'OPS-3' })]),
    );
  });

  it('records a failure and resumes from the checkpoint', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const failing = await startFakeSite({
      kind: 'jira-cloud',
      failWhen: (path, url) =>
        path.endsWith('/search/jql') && url.searchParams.get('nextPageToken') === '4',
    });
    try {
      await sql`delete from projects where key = 'OPS'`;
      const created = await calls.connect('jira', failing);
      await calls.pick(created.body.id, ['10000']);
      const failed = await calls.run(created.body.id);
      expect(failed.status).toBe('failed');
      expect(failed.error).toMatch(/500/);
      expect(await sql`select 1 from issues`).toHaveLength(4);
      failing.options.failWhen = undefined;
      const resumed = await calls.run(created.body.id);
      expect(resumed.status, resumed.error ?? '').toBe('completed');
      expect(resumed.runs).toBe(failed.runs);
      expect((await sql`select key from issues order by number`).map((r) => r['key'])).toEqual([
        'OPS-1',
        'OPS-2',
        'OPS-3',
        'OPS-5',
        'OPS-6',
      ]);
      const pages = failing.requests.filter((r) => r.endsWith('/search/jql'));
      expect(pages).toHaveLength(4);
    } finally {
      await failing.close();
    }
  });

  it('imports from Data Center with wiki markup, epic links and kanban boards', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const dc = await startFakeSite({ kind: 'jira-dc' });
    try {
      const created = await calls.connect('jira', dc, 'datacenter');
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      await calls.pick(created.body.id, ['11000']);
      const done = await calls.run(created.body.id);
      expect(done.status, done.error ?? '').toBe('completed');
      const rows = await sql<{ key: string; parent: string | null; description: unknown }[]>`
        select i.key, p.key as parent, i.description from issues i
        left join issues p on p.id = i.parent_id
        join projects pr on pr.id = i.project_id where pr.key = 'LEGACY1' order by i.number`;
      expect(rows.map((r) => [r.key, r.parent])).toEqual([
        ['LEGACY1-1', null],
        ['LEGACY1-2', 'LEGACY1-1'],
      ]);
      expect(JSON.stringify(rows[0]!.description)).toContain('"type":"codeBlock"');
      expect(done.report.warnings).toContain(
        'Project LEGACY_1 is LEGACY1 here; its issue keys follow.',
      );
      const [comment] = await sql<{ body: unknown }[]>`
        select c.body from comments c join issues i on i.id = c.target_id where i.key = 'LEGACY1-1'`;
      expect(JSON.stringify(comment!.body)).toContain('"type":"mention"');
    } finally {
      await dc.close();
    }
  });
});
