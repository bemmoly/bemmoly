import type { SqlClient } from '@bemmoly/core';
import type { ImportJob, ImportPeoplePage, ImportSource } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness } from './boot-harness.ts';
import { startFakeSite, type FakeSite } from './imports/fake-atlassian.ts';
import { importCalls } from './imports/import-calls.ts';

/*
 * Options and mapping against the fake Jira site: what to bring (turned off, nothing of it is
 * written), where each project goes (a taken key blocks the run and is never merged; a new key
 * or an existing project is used as asked), and people matched at plan time with the admin's
 * choices respected by the run.
 */

interface Ctx {
  harness: BootHarness;
  calls: ReturnType<typeof importCalls>;
  sql: SqlClient;
  site: FakeSite;
}

/** A fresh install with Work on and the fixture Jira site, per scenario. */
function scenario() {
  const box: { ctx?: Ctx; skip: string } = { skip: '' };
  beforeAll(async () => {
    const started = await startBootHarness();
    if (!started.available) {
      box.skip = started.reason;
      return;
    }
    const app = await started.harness.boot('', { BEMMOLY_ALLOW_PRIVATE_URLS: 'true' });
    const calls = importCalls(app);
    await calls.call('POST', '/admin/modules/work/enable', { access: { mode: 'everyone' } });
    box.ctx = {
      harness: started.harness,
      calls,
      sql: app.instance.database!.sql,
      site: await startFakeSite({ kind: 'jira-cloud' }),
    };
  });
  afterAll(async () => {
    await box.ctx?.site.close();
    await box.ctx?.harness.stop();
  });
  return box;
}

const plan = (c: Ctx, id: string, body: object) =>
  c.calls.call<ImportJob>('PATCH', `/admin/imports/${id}`, body);

describe('Where each project goes', () => {
  const box = scenario();
  let job: ImportJob;

  it('offers what to bring and plans with the defaults', async (t) => {
    const c = box.ctx;
    if (!c) return t.skip(box.skip);
    const sources = await c.calls.call<{ items: ImportSource[] }>('GET', '/admin/import-sources');
    const jira = sources.body.items.find((source) => source.id === 'jira')!;
    expect(jira.options.map((option) => [option.name, option.default])).toEqual([
      ['comments', true],
      ['attachments', true],
      ['agile', true],
      ['links', true],
      ['history', false],
    ]);
    job = (await c.calls.connect('jira', c.site)).body;
    const planned = await plan(c, job.id, {});
    expect(planned.status, JSON.stringify(planned.body)).toBe(200);
    expect(planned.body.plan).toMatchObject({
      containers: ['10000'],
      include: { comments: true, attachments: true, agile: true, links: true, history: false },
      onClash: 'error',
      targets: { create: 1, existing: 0, update: 0, errors: 0, renamed: 0 },
    });
  });

  it('makes a taken key an error that blocks the run, not a merge', async (t) => {
    const c = box.ctx;
    if (!c) return t.skip(box.skip);
    await c.sql`insert into projects (key, name, method) values ('OPS', 'Ops here', 'kanban')`;
    const planned = await plan(c, job.id, {});
    expect(planned.body.plan?.targets).toMatchObject({ errors: 1 });
    const rows = await c.calls.containers(job.id, 'filter=attention');
    expect(rows.body.items[0]?.target).toMatchObject({
      mode: 'create',
      key: 'OPS',
      error:
        'OPS is taken by Ops here (a Work project). Pick another key, or bring these issues into Ops here.',
    });
    const refused = await c.calls.call('POST', `/admin/imports/${job.id}/run`);
    expect(refused.status).toBe(400);
    expect(refused.body['message']).toMatch(/key that is taken/);
    expect(await c.sql`select 1 from issues`).toHaveLength(0);
  });

  it('refuses a key that breaks the rule before planning', async (t) => {
    const c = box.ctx;
    if (!c) return t.skip(box.skip);
    const bad = await plan(c, job.id, { targets: { '10000': { mode: 'create', key: 'ops-2' } } });
    expect(bad.status).toBe(400);
  });

  it('brings the project in under the new key it is given', async (t) => {
    const c = box.ctx;
    if (!c) return t.skip(box.skip);
    const planned = await plan(c, job.id, {
      targets: { '10000': { mode: 'create', key: 'OPSX' } },
    });
    expect(planned.body.plan?.targets).toMatchObject({ create: 1, errors: 0, renamed: 1 });
    const done = await c.calls.run(job.id);
    expect(done.status, done.error ?? '').toBe('completed');
    const rows = await c.sql<{ key: string; issues: number }[]>`
      select p.key, count(i.id)::int as issues from projects p
      left join issues i on i.project_id = p.id group by p.key order by p.key`;
    expect(rows).toEqual([
      { key: 'OPS', issues: 0 },
      { key: 'OPSX', issues: 5 },
    ]);
  });
});

describe('Into an existing project, or the next free key', () => {
  const box = scenario();

  it('writes into the chosen existing project', async (t) => {
    const c = box.ctx;
    if (!c) return t.skip(box.skip);
    const [target] = await c.sql<{ id: string }[]>`
      insert into projects (key, name, method) values ('SHOP', 'Storefront', 'scrum') returning id`;
    await c.sql`insert into project_counters (project_id) values (${target!.id})`;
    const job = (await c.calls.connect('jira', c.site)).body;
    const planned = await plan(c, job.id, {
      targets: { '10000': { mode: 'existing', id: target!.id } },
    });
    expect(planned.body.plan?.targets).toMatchObject({ existing: 1, errors: 0 });
    expect(
      (planned.body as { attention?: { key: string }[] }).attention?.map((r) => r.key),
    ).toEqual(['OPS']);
    const picker = await c.calls.call<{ items: { key: string }[] }>(
      'GET',
      `/admin/imports/${job.id}/targets?q=store`,
    );
    expect(picker.body.items.map((item) => item.key)).toEqual(['SHOP']);
    const row = (await c.calls.containers(job.id, 'filter=attention')).body.items[0];
    expect(row?.target).toMatchObject({ mode: 'existing', key: 'SHOP', name: 'Storefront' });
    expect(row?.target?.note).toBe('Its issues are numbered on from the last SHOP key.');
    expect((await c.calls.run(job.id)).status).toBe('completed');
    const keys = await c.sql<{ key: string }[]>`select key from issues order by number`;
    expect(keys.map((k) => k.key)).toEqual(['SHOP-1', 'SHOP-2', 'SHOP-3', 'SHOP-5', 'SHOP-6']);
    expect(await c.sql`select 1 from projects where key = 'OPS'`).toHaveLength(0);

    // A second project into the same one numbers on from SHOP-6, parents and all.
    const dc = await startFakeSite({ kind: 'jira-dc' });
    try {
      const second = (await c.calls.connect('jira', dc, 'datacenter')).body;
      await plan(c, second.id, {
        containers: ['11000'],
        targets: { '11000': { mode: 'existing', id: target!.id } },
      });
      const done = await c.calls.run(second.id);
      expect(done.status, done.error ?? '').toBe('completed');
      const rows = await c.sql<{ key: string; parent: string | null }[]>`
        select i.key, p.key as parent from issues i left join issues p on p.id = i.parent_id
        where i.number > 6 order by i.number`;
      expect(rows).toEqual([
        { key: 'SHOP-7', parent: null },
        { key: 'SHOP-8', parent: 'SHOP-7' },
      ]);
      const again = await c.calls.run(second.id);
      expect(again.status, again.error ?? '').toBe('completed');
      expect(await c.sql`select 1 from issues`).toHaveLength(7);
    } finally {
      await dc.close();
    }
  });

  it('takes the next free key on the short path and says so', async (t) => {
    const c = box.ctx;
    if (!c) return t.skip(box.skip);
    await c.sql`insert into projects (key, name, method) values ('MKT', 'Marketing', 'kanban')`;
    const job = (await c.calls.connect('jira', c.site)).body;
    const planned = await plan(c, job.id, { containers: ['10001'], onClash: 'suffix' });
    expect(planned.body.plan?.targets).toMatchObject({ errors: 0, renamed: 1 });
    const row = (await c.calls.containers(job.id, 'filter=selected')).body.items[0];
    expect(row?.target).toMatchObject({
      key: 'MKT2',
      note: 'MKT is taken by Marketing (a Work project); it becomes MKT2.',
    });
  });
});

describe('What to bring and who people are', () => {
  const box = scenario();

  it('lists the people the chosen projects name, matched by email', async (t) => {
    const c = box.ctx;
    if (!c) return t.skip(box.skip);
    const job = (await c.calls.connect('jira', c.site)).body;
    const planned = await plan(c, job.id, {});
    expect(planned.body.plan?.people).toEqual({ total: 3, matched: 1, placeholders: 1, hidden: 1 });
    const people = await c.calls.call<ImportPeoplePage>('GET', `/admin/imports/${job.id}/people`);
    expect(people.body.items.map((p) => [p.name, p.match])).toEqual([
      ['Grace H.', 'hidden'],
      ['Ada L.', 'placeholder'],
      ['Rohan S.', 'matched'],
    ]);
  });

  it('brings only the issues when the extras are off, and respects people choices', async (t) => {
    const c = box.ctx;
    if (!c) return t.skip(box.skip);
    const [admin] = await c.sql<{ id: string }[]>`
      select id from users where email = 'rohan@acmelabs.dev'`;
    const job = (await c.calls.connect('jira', c.site)).body;
    const planned = await plan(c, job.id, {
      include: { comments: false, attachments: false, agile: false, links: false },
      people: { 'acc-ada': admin!.id, 'acc-admin': 'placeholder' },
    });
    expect(planned.body.plan?.people).toEqual({ total: 3, matched: 1, placeholders: 1, hidden: 1 });
    const unknown = await plan(c, job.id, { people: { 'acc-nobody': 'placeholder' } });
    expect(unknown.status).toBe(400);
    const done = await c.calls.run(job.id);
    expect(done.status, done.error ?? '').toBe('completed');
    expect(await c.sql`select 1 from issues`).toHaveLength(5);
    expect(await c.sql`select 1 from comments`).toHaveLength(0);
    expect(await c.sql`select 1 from attachments`).toHaveLength(0);
    expect(await c.sql`select 1 from sprints`).toHaveLength(0);
    expect(
      await c.sql`select 1 from boards b join projects p on p.id = b.project_id
      where p.key = 'OPS' and b.name = 'OPS board'`,
    ).toHaveLength(0);
    expect(await c.sql`select 1 from issue_links`).toHaveLength(0);
    expect(await c.sql`select 1 from users where email = 'ada@example.test'`).toHaveLength(0);
    const [placeholder] = await c.sql<{ status: string }[]>`
      select u.status from import_mappings m join users u on u.id = m.target_id
      where m.kind = 'user' and m.source_id = 'acc-admin'`;
    expect(placeholder?.status).toBe('deactivated');
  });
});

describe('Confluence options and spaces', () => {
  const box: { ctx?: Ctx; skip: string } = { skip: '' };
  beforeAll(async () => {
    const started = await startBootHarness();
    if (!started.available) {
      box.skip = started.reason;
      return;
    }
    const app = await started.harness.boot('', { BEMMOLY_ALLOW_PRIVATE_URLS: 'true' });
    const calls = importCalls(app);
    // Docs resolves the fixture's issue mentions through Work, so Work is on as well.
    await calls.call('POST', '/admin/modules/work/enable', { access: { mode: 'everyone' } });
    await calls.call('POST', '/admin/modules/docs/enable', { access: { mode: 'everyone' } });
    box.ctx = {
      harness: started.harness,
      calls,
      sql: app.instance.database!.sql,
      site: await startFakeSite({ kind: 'confluence' }),
    };
  });
  afterAll(async () => {
    await box.ctx?.site.close();
    await box.ctx?.harness.stop();
  });

  it('blocks a taken space key, then brings pages without comments or files', async (t) => {
    const c = box.ctx;
    if (!c) return t.skip(box.skip);
    await c.sql`insert into spaces (key, name) values ('HR', 'People team here')`;
    const job = (await c.calls.connect('confluence', c.site)).body;
    const planned = await plan(c, job.id, { include: { comments: false, attachments: false } });
    expect(planned.body.plan).toMatchObject({
      include: { comments: false, attachments: false, agile: false, links: false, history: false },
      targets: { errors: 1 },
      people: { total: 2, matched: 0, placeholders: 1, hidden: 1 },
    });
    const fixed = await plan(c, job.id, { targets: { HR: { mode: 'create', key: 'HRTEAM' } } });
    expect(fixed.body.plan?.targets).toMatchObject({ errors: 0 });
    const done = await c.calls.run(job.id);
    expect(done.status, done.error ?? '').toBe('completed');
    expect(await c.sql`select 1 from pages`).toHaveLength(4);
    expect(await c.sql`select 1 from page_comments`).toHaveLength(0);
    expect(await c.sql`select 1 from files`).toHaveLength(0);
    const spaces = await c.sql<{ key: string; pages: number }[]>`
      select s.key, count(p.id)::int as pages from spaces s left join pages p on p.space_id = s.id
      group by s.key order by s.key`;
    expect(spaces).toEqual([
      { key: 'ENG', pages: 3 },
      { key: 'HR', pages: 0 },
      { key: 'HRTEAM', pages: 1 },
    ]);
  });
});
