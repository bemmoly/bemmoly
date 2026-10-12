import type { SqlClient } from '@bemmoly/core';
import type { ImportContainerRow, ImportJob, ImportSelectionSummary } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness } from './boot-harness.ts';
import { startFakeSite, type FakeSite } from './imports/fake-atlassian.ts';
import { generateProjects } from './imports/generate.ts';
import { importCalls } from './imports/import-calls.ts';

/*
 * Choosing what to import from a big Jira site, against the fake source with 1,500 generated
 * projects: connecting lists without counting, the list pages, searches and filters on the
 * server, counts arrive only for the rows asked about, unreadable projects are flagged and
 * locked, a selection of 1,484 travels as one operation, and the plan takes all of them.
 */

const SIZE = 1500;

describe('Choosing from a 1,500-project site', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';
  let calls: ReturnType<typeof importCalls>;
  let sql: SqlClient;
  let site: FakeSite;
  let job: ImportJob;
  const generated = generateProjects(SIZE);
  /** Every readable project but the first ten (one of which is unreadable anyway). */
  const CHOSEN = SIZE - generated.unbrowsable.size - 9;
  const select = (id: string, ops: unknown[]) =>
    calls.call<ImportSelectionSummary>('PATCH', `/admin/imports/${id}/selection`, { ops });

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
    site = await startFakeSite({ kind: 'jira-cloud', ...generated });
  });

  afterAll(async () => {
    await site?.close();
    await harness?.stop();
  });

  it('connects by listing, without counting a single project', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const created = await calls.connect('jira', site);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    job = created.body;
    expect(job.discovery).toMatchObject({ total: SIZE, counts: { projects: SIZE } });
    expect(site.requests.filter((r) => r.includes('approximate-count'))).toHaveLength(0);
    const [{ counted } = { counted: -1 }] = await sql<{ counted: number }[]>`
      select count(*)::int as counted from import_containers
      where job_id = ${job.id} and count is not null`;
    expect(counted).toBe(0);
    const summary = await calls.call<ImportSelectionSummary>(
      'GET',
      `/admin/imports/${job.id}/selection`,
    );
    expect(summary.body).toEqual({ selected: 0, records: 0, uncounted: 0 });
  });

  it('pages the list in order and flags what the token cannot read', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const first = await calls.containers(job.id);
    expect(first.body.items).toHaveLength(100);
    expect(first.body.counts).toEqual({
      all: SIZE,
      new: SIZE - generated.unbrowsable.size,
      imported: 0,
      noaccess: generated.unbrowsable.size,
      selected: 0,
    });
    expect(first.body.items[0]).toMatchObject({
      key: 'G1',
      type: 'Software',
      lead: 'Person 0',
      access: 'ok',
      count: null,
    });
    expect(first.body.items[5]).toMatchObject({ key: 'G6', access: 'none' });
    const seen: ImportContainerRow[] = [];
    for (let cursor: string | null = ''; cursor !== null;) {
      const page = await calls.containers(job.id, `limit=200${cursor ? `&cursor=${cursor}` : ''}`);
      seen.push(...page.body.items);
      cursor = page.body.next;
    }
    expect(new Set(seen.map((row) => row.id)).size).toBe(SIZE);
    expect(seen.map((row) => row.key)).toEqual(generated.projects.map((p) => p.key));
  });

  it('searches and filters on the server over the whole list', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const harbor = await calls.containers(job.id, 'q=harbor&limit=200');
    const expected = generated.projects.filter((p) => p.name.toLowerCase().includes('harbor'));
    expect(harbor.body.view.total).toBe(expected.length);
    expect(harbor.body.items.every((row) => row.name.includes('Harbor'))).toBe(true);
    const byKey = await calls.containers(job.id, 'q=G1499');
    expect(byKey.body.items.map((row) => row.key)).toEqual(['G1499']);
    const locked = await calls.containers(job.id, 'filter=noaccess');
    expect(locked.body.items).toHaveLength(generated.unbrowsable.size);
    expect(locked.body.view).toEqual({
      total: generated.unbrowsable.size,
      selectable: 0,
      selected: 0,
    });
    const none = await calls.containers(job.id, 'q=nothing-like-this');
    expect(none.body).toMatchObject({ items: [], next: null, view: { total: 0 } });
  });

  it('counts only the rows asked about, 50 at a time through insight, and keeps them', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const ids = generated.projects.slice(0, 100).map((p) => p.id);
    const before = site.requests.length;
    const counted = await calls.call<{ items: { id: string; count: number }[] }>(
      'POST',
      `/admin/imports/${job.id}/containers/counts`,
      { ids },
    );
    expect(counted.status).toBe(200);
    const asked = site.requests.slice(before);
    expect(asked.filter((r) => r.endsWith('/project/search'))).toHaveLength(2);
    expect(asked.filter((r) => r.includes('approximate-count'))).toHaveLength(0);
    const browsable = generated.projects
      .slice(0, 100)
      .filter((p) => !generated.unbrowsable.has(p.id));
    expect(counted.body.items).toHaveLength(browsable.length);
    expect(counted.body.items[0]).toEqual({ id: '50000', count: generated.issueCounts['G1'] });
    const again = site.requests.length;
    await calls.call('POST', `/admin/imports/${job.id}/containers/counts`, { ids });
    expect(site.requests.length).toBe(again);
  });

  it('falls back to one count per project when insight is missing', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const plain = await startFakeSite({ kind: 'jira-cloud', ...generated, noInsight: true });
    try {
      const created = await calls.connect('jira', plain);
      const ids = generated.projects.slice(10, 13).map((p) => p.id);
      const counted = await calls.call<{ items: { id: string; count: number }[] }>(
        'POST',
        `/admin/imports/${created.body.id}/containers/counts`,
        { ids },
      );
      expect(counted.body.items.map((item) => item.count)).toEqual(
        ['G11', 'G12', 'G13'].map((key) => generated.issueCounts[key]),
      );
      expect(plain.requests.filter((r) => r.includes('approximate-count'))).toHaveLength(3);
    } finally {
      await plain.close();
    }
  });

  it('selects all but a few with two operations and undoes a clear', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const all = await select(job.id, [{ select: true, scope: { filter: 'all' } }]);
    expect(all.body.selected).toBe(SIZE - generated.unbrowsable.size);
    const except = generated.projects.slice(0, 10).map((p) => p.id);
    const some = await select(job.id, [{ select: false, ids: except }]);
    expect(some.body.selected).toBe(CHOSEN);
    // The first 100 rows were counted: 99 readable, 9 of them now unticked.
    expect(some.body.uncounted).toBe(CHOSEN - 90);
    const unreadable = [...generated.unbrowsable][0]!;
    expect((await select(job.id, [{ select: true, ids: [unreadable] }])).body.selected).toBe(
      CHOSEN,
    );
    expect((await select(job.id, [{ clear: true }])).body.selected).toBe(0);
    expect((await select(job.id, [{ restore: true }])).body.selected).toBe(CHOSEN);
    const view = await calls.containers(job.id, 'filter=selected&limit=1');
    expect(view.body.view.selected).toBe(CHOSEN);
    expect(view.body.items[0]?.key).toBe('G11');
  });

  it('plans every chosen project, well past the old 500 cap', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const planned = await calls.call<ImportJob>('PATCH', `/admin/imports/${job.id}`, {});
    expect(planned.status, JSON.stringify(planned.body)).toBe(200);
    const picked = generated.projects.filter(
      (p, index) => index >= 10 && !generated.unbrowsable.has(p.id),
    );
    expect(planned.body.plan?.containers).toHaveLength(CHOSEN);
    expect(planned.body.plan?.counts).toEqual({
      projects: CHOSEN,
      issues: picked.reduce((sum, p) => sum + generated.issueCounts[p.key]!, 0),
    });
    const ids = generated.projects.slice(0, 600).map((p) => p.id);
    const named = await calls.pick(job.id, ids);
    expect(named.status, JSON.stringify(named.body)).toBe(200);
    expect((await calls.containers(job.id, 'filter=selected&limit=1')).body.view.selected).toBe(
      ids.length -
        generated.projects.slice(0, 600).filter((p) => generated.unbrowsable.has(p.id)).length,
    );
  });
});

describe('Choosing again after an import', () => {
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
    site = await startFakeSite({ kind: 'jira-cloud' });
  });

  afterAll(async () => {
    await site?.close();
    await harness?.stop();
  });

  it('marks what was imported before and keys in use, and leaves both unticked', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const first = await calls.connect('jira', site);
    await calls.pick(first.body.id, ['10000']);
    expect((await calls.run(first.body.id)).status).toBe('completed');
    await sql`insert into projects (key, name, method) values ('MKT', 'Marketing here', 'kanban')`;
    const second = await calls.connect('jira', site);
    const { body } = await calls.containers(second.body.id);
    const [ops, mkt] = body.items;
    expect(ops).toMatchObject({ key: 'OPS', keyInUse: false, selected: false });
    expect(ops?.imported).toMatchObject({ key: 'OPS', name: 'Operations' });
    expect(mkt).toMatchObject({ key: 'MKT', imported: null, keyInUse: true });
    expect(body.counts).toMatchObject({ imported: 1, new: 1 });
    const imported = await calls.containers(second.body.id, 'filter=imported');
    expect(imported.body.items.map((row) => row.key)).toEqual(['OPS']);
  });
});
