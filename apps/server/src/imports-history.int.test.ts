import type { SqlClient } from '@bemmoly/core';
import type { ImportJob } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness } from './boot-harness.ts';
import { startFakeSite, type FakeSite } from './imports/fake-atlassian.ts';
import { importCalls } from './imports/import-calls.ts';

/*
 * Change history, only when asked for: Jira changelogs (Cloud in bulk, Data Center on the
 * search) become issue history dated when the change happened, and earlier Confluence page
 * versions become imported revisions; left off, none of it is written; run again, nothing
 * is written twice.
 */

describe('Change history', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';
  let calls: ReturnType<typeof importCalls>;
  let sql: SqlClient;
  const sites: FakeSite[] = [];

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
  });

  afterAll(async () => {
    for (const site of sites) await site.close();
    await harness?.stop();
  });

  const site = async (kind: 'jira-cloud' | 'jira-dc' | 'confluence') => {
    const started = await startFakeSite({ kind });
    sites.push(started);
    return started;
  };
  const importWith = async (
    source: string,
    from: FakeSite,
    containers: string[],
    history: boolean,
    deployment: 'cloud' | 'datacenter' = 'cloud',
  ): Promise<ImportJob> => {
    const job = (await calls.connect(source, from, deployment)).body;
    const planned = await calls.call<ImportJob>('PATCH', `/admin/imports/${job.id}`, {
      containers,
      include: { history },
    });
    expect(planned.status, JSON.stringify(planned.body)).toBe(200);
    const done = await calls.run(job.id);
    expect(done.status, done.error ?? '').toBe('completed');
    return done;
  };
  const imported = () =>
    sql<
      { key: string; field: string; from: unknown; to: unknown; at: string; actor: string | null }[]
    >`
      select i.key, h.field, h.from_value as from, h.to_value as to,
        to_char(h.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24') as at, u.name as actor
      from issue_history h join issues i on i.id = h.issue_id
      left join users u on u.id = h.actor_id
      where h.field in ('title', 'statusId') order by h.id`;

  it('offers it unticked and writes nothing of it when left off', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const cloud = await site('jira-cloud');
    const job = (await calls.connect('jira', cloud)).body;
    const planned = await calls.call<ImportJob>('PATCH', `/admin/imports/${job.id}`, {});
    expect(planned.body.plan?.include?.history).toBe(false);
    const done = await calls.run(job.id);
    expect(done.status).toBe('completed');
    expect(await imported()).toHaveLength(0);
    expect(cloud.requests.filter((r) => r.includes('changelog'))).toHaveLength(0);
  });

  it('brings Jira Cloud changelogs as issue history, in the order they happened', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    await sql`delete from projects where key = 'OPS'`;
    const cloud = await site('jira-cloud');
    await importWith('jira', cloud, ['10000'], true);
    const rows = await imported();
    const ops1 = rows.filter((row) => row.key === 'OPS-1');
    expect(ops1.map((row) => row.field)).toEqual(['title', 'statusId']);
    expect(ops1[0]).toMatchObject({ from: 'Draft of OPS-1' });
    const [statuses] = await sql<{ todo: string; progress: string }[]>`
      select (select s.id from workflow_statuses s join workflows w on w.id = s.workflow_id
        join projects p on p.id = w.project_id where p.key = 'OPS' and s.name = 'To Do') as todo,
        (select s.id from workflow_statuses s join workflows w on w.id = s.workflow_id
        join projects p on p.id = w.project_id where p.key = 'OPS' and s.name = 'In progress')
        as progress`;
    expect(ops1[1]).toMatchObject({ from: statuses!.todo, to: statuses!.progress });
    expect(rows.filter((row) => row.field === 'statusId')).toHaveLength(3);
    expect(rows.filter((row) => row.field === 'title')).toHaveLength(5);
    expect(rows.map((row) => row.at)).toEqual([...rows.map((row) => row.at)].sort());
    expect(cloud.requests.filter((r) => r.endsWith('/changelog/bulkfetch')).length).toBeGreaterThan(
      0,
    );

    await importWith('jira', cloud, ['10000'], true);
    expect(await imported()).toHaveLength(rows.length);
  });

  it('reads Data Center changelogs from the search', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const dc = await site('jira-dc');
    await importWith('jira', dc, ['11000'], true, 'datacenter');
    const rows = (await imported()).filter((row) => row.key.startsWith('LEGACY1-'));
    expect(rows.map((row) => [row.key, row.field])).toEqual([
      ['LEGACY1-1', 'title'],
      ['LEGACY1-2', 'title'],
      ['LEGACY1-2', 'statusId'],
    ]);
  });

  it('brings earlier Confluence page versions as imported revisions', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const wiki = await site('confluence');
    await importWith('confluence', wiki, ['ENG'], true);
    const revisions = await sql<
      { title: string; number: number; label: string; kind: string; text: string }[]
    >`
      select p.title, r.number, r.label, r.kind, r.text from page_revisions r
      join pages p on p.id = r.page_id where r.kind = 'imported' order by p.title, r.number`;
    const byPage = (title: string) => revisions.filter((row) => row.title === title);
    const counts = new Map<string, number>();
    for (const row of revisions) counts.set(row.title, (counts.get(row.title) ?? 0) + 1);
    expect([...counts.values()].sort()).toEqual([2, 6]);
    const longest = [...counts.entries()].find(([, n]) => n === 6)![0];
    expect(byPage(longest).map((row) => [row.number, row.label])).toEqual(
      [1, 2, 3, 4, 5, 6].map((n) => [n, `Version ${n} from Confluence`]),
    );
    expect(byPage(longest)[0]!.text).toContain('Version 1 of');
    await importWith('confluence', wiki, ['ENG'], true);
    expect(await sql`select 1 from page_revisions where kind = 'imported'`).toHaveLength(8);
  });
});
