import type { SqlClient } from '@bemmoly/core';
import type { ImportJob, ImportSource } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness } from './boot-harness.ts';
import { startFakeSite, type FakeSite } from './imports/fake-atlassian.ts';
import { importCalls } from './imports/import-calls.ts';

/*
 * The Confluence importer (into Docs) and the CSV importer (into Work) on the real boot path:
 * a space's page tree with links rewritten to the imported pages and issues, unknown macros
 * kept as labelled blocks, comment threads, labels and attachments; a CSV whose second import
 * updates the first.
 */

const CSV = [
  'Issue key,Summary,Description,Status,Priority,Assignee,Labels,Parent,Sprint name',
  'WEB-1,Launch the new site,"Ship **v2**, with ""quotes"" kept",In Progress,High,ada@example.test,"web,launch",,S1',
  'WEB-2,Write the copy,,Done,Low,,copy,WEB-1,S1',
  'WEB-4,Fix the footer,"Two\nlines",Blocked,,,,,',
].join('\n');

describe('Confluence and CSV import', () => {
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
    await calls.call('POST', '/admin/modules/docs/enable', { access: { mode: 'everyone' } });
    site = await startFakeSite({ kind: 'confluence' });
  });

  afterAll(async () => {
    await site?.close();
    await harness?.stop();
  });

  it('offers Confluence once Docs is on', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { body } = await calls.call<{ items: ImportSource[] }>('GET', '/admin/import-sources');
    expect(body.items.map((source) => source.id)).toEqual(
      expect.arrayContaining(['jira', 'csv', 'confluence']),
    );
  });

  it('imports spaces, the page tree, bodies, comments and attachments', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const created = await calls.connect('confluence', site);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.discovery?.containers.map((c) => [c.key, c.count])).toEqual([
      ['ENG', 3],
      ['HR', 1],
    ]);
    const planned = await calls.pick(created.body.id, ['ENG', 'HR']);
    expect(planned.body.plan?.counts).toEqual({ spaces: 2, pages: 4 });
    const done = await calls.run(created.body.id);
    expect(done.status, done.error ?? '').toBe('completed');
    expect(done.report.counts['pages']).toMatchObject({ created: 4 });

    const pages = await sql<
      { id: string; title: string; parent: string | null; snapshot: unknown; status: string }[]
    >`
      select p.id, p.title, parent.title as parent, p.snapshot, p.status from pages p
      left join pages parent on parent.id = p.parent_id order by p.title`;
    const byTitle = new Map(pages.map((page) => [page.title, page]));
    expect(pages.map((page) => [page.title, page.parent])).toEqual([
      ['Deploy runbook', 'Runbooks'],
      ['Engineering home', null],
      ['Onboarding', null],
      ['Runbooks', 'Engineering home'],
    ]);
    const deploy = JSON.stringify(byTitle.get('Deploy runbook')!.snapshot);
    expect(deploy).toContain(`"href":"/docs/p/${byTitle.get('Engineering home')!.id}"`);
    expect(deploy).toContain('"href":"/work/issue/OPS-2"');
    expect(deploy).toContain('"type":"issueEmbed","attrs":{"key":"OPS-2"}');
    expect(deploy).toContain('"type":"unsupportedBlock"');
    expect(deploy).toContain('"name":"roadmap"');
    expect(deploy).toContain('"type":"mention"');
    const home = JSON.stringify(byTitle.get('Engineering home')!.snapshot);
    expect(home).toContain(`"pageId":"${byTitle.get('Runbooks')!.id}"`);
    const onboarding = JSON.stringify(byTitle.get('Onboarding')!.snapshot);
    expect(onboarding).toContain(`"pageId":"${byTitle.get('Engineering home')!.id}"`);

    const comments = await sql<{ text: string; parent: string | null }[]>`
      select c.body_text as text, parent.body_text as parent from page_comments c
      left join page_comments parent on parent.id = c.parent_id order by c.created_at`;
    expect(comments).toEqual([
      { text: 'Should we add the rollback steps?', parent: null },
      { text: 'Yes, below the deploy section.', parent: 'Should we add the rollback steps?' },
    ]);
    expect((await sql`select name from page_labels order by name`).map((r) => r['name'])).toEqual([
      'home',
      'ops',
      'runbook',
    ]);
    const [attachment] = await sql<{ meta: Record<string, unknown> }[]>`
      select meta from import_mappings where kind = 'attachment' and source = 'confluence'`;
    expect(attachment!.meta).toMatchObject({ filename: 'flow.png', mime: 'image/png', size: 16 });
    const fileId = String(attachment!.meta['fileId']);
    expect(deploy).toContain(`"src":"/api/v1/files/${fileId}"`);
    const [file] = await sql<{ target_kind: string; target_id: string }[]>`
      select target_kind, target_id from files where id = ${fileId}`;
    expect(file).toEqual({
      target_kind: 'docs.page',
      target_id: byTitle.get('Deploy runbook')!.id,
    });
    expect(done.report.warnings).toContain('Inline comments were imported as page comments.');
  });

  it('skips unchanged pages on a re-run and leaves pages edited here alone', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const [job] = await sql<
      { id: string }[]
    >`select id from import_jobs where source = 'confluence'`;
    await sql`update pages set text = 'Rewritten here' where title = 'Runbooks'`;
    const again = await calls.run(job!.id);
    expect(again.status, again.error ?? '').toBe('completed');
    expect(await sql`select 1 from pages`).toHaveLength(4);
    expect(await sql`select 1 from page_comments`).toHaveLength(2);
    expect(again.report.counts['pages']).toMatchObject({ created: 0, skipped: 4 });
    expect(again.report.skipped).toEqual([
      expect.objectContaining({ kind: 'page', source: 'Runbooks' }),
    ]);
  });

  it('imports a CSV into a project and updates it on a second import', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const created = await calls.call<ImportJob>('POST', '/admin/imports', {
      source: 'csv',
      values: { file: CSV, project: 'WEB', projectName: 'Website' },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.connection).toEqual({ file: true, project: 'WEB', projectName: 'Website' });
    const planned = await calls.pick(created.body.id, ['file']);
    expect(planned.body.plan?.mappings.find((m) => m.source === 'Sprint name')?.action).toBe(
      'report',
    );
    const done = await calls.run(created.body.id);
    expect(done.status, done.error ?? '').toBe('completed');
    const rows = await sql<
      { key: string; title: string; status: string; parent: string | null; priority: string }[]
    >`
      select i.key, i.title, s.name as status, p.key as parent, i.priority from issues i
      join workflow_statuses s on s.id = i.status_id left join issues p on p.id = i.parent_id
      join projects pr on pr.id = i.project_id where pr.key = 'WEB' order by i.number`;
    expect(rows).toEqual([
      {
        key: 'WEB-1',
        title: 'Launch the new site',
        status: 'In progress',
        parent: null,
        priority: 'high',
      },
      { key: 'WEB-2', title: 'Write the copy', status: 'Done', parent: 'WEB-1', priority: 'low' },
      {
        key: 'WEB-4',
        title: 'Fix the footer',
        status: 'Blocked',
        parent: null,
        priority: 'medium',
      },
    ]);
    expect(done.report.skipped).toEqual([
      expect.objectContaining({ kind: 'column', source: 'Sprint name' }),
    ]);

    const second = await calls.call<ImportJob>('POST', '/admin/imports', {
      source: 'csv',
      values: { file: CSV.replace('Write the copy', 'Write the launch copy'), project: 'WEB' },
    });
    await calls.pick(second.body.id, ['file']);
    const updated = await calls.run(second.body.id);
    expect(updated.report.counts['issues']).toMatchObject({ created: 0, updated: 3 });
    const titles =
      await sql`select title from issues i join projects p on p.id = i.project_id where p.key = 'WEB' order by number`;
    expect(titles.map((row) => row['title'])).toEqual([
      'Launch the new site',
      'Write the launch copy',
      'Fix the footer',
    ]);
  });

  it('refuses a CSV with no title column', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const refused = await calls.call('POST', '/admin/imports', {
      source: 'csv',
      values: { file: 'Key,Owner\nA-1,ada', project: 'WEB' },
    });
    expect(refused.status).toBe(400);
    expect(refused.body['message']).toMatch(/title/);
  });
});
