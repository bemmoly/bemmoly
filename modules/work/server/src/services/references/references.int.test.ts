import { loadModules, type ModuleContext } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startWorkHarness, type WorkHarness } from '../int-support.ts';
import { createIssueReferences, LINKED_PAGE_IDS, registerWorkReferences } from './index.ts';

/*
 * Issues as other modules see them through the kernel: by key or id with
 * what an embed shows, filtered to the projects a person may view, and the
 * issues whose description links a page.
 */

const PAGE_ID = '0192f3a0-0000-7000-8000-00000000beef';
const LINKED_PAGE = '0192f3a0-0000-7000-8000-00000000d00d';
const OTHER_PAGE = '0192f3a0-0000-7000-8000-00000000cafe';

const linkTo = (pageId: string) => ({ type: 'pageLink', attrs: { pageId, title: 'A page' } });
const doc = (...content: object[]) => ({ type: 'doc' as const, content });

describe('work issue references', () => {
  let harness: WorkHarness | null = null;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startWorkHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });

  afterAll(async () => {
    await harness?.stop();
  });

  it('resolves issues by key or id, with status and type, for viewers only', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { as, users, sql } = harness;
    const project = await harness.project('REF', [users.member]);
    const issue = await harness.issue(project, 'Cache warmup');
    const refs = createIssueReferences(sql);

    const byKey = await refs.resolve({ key: issue.key.toLowerCase() });
    expect(byKey).toMatchObject({
      kind: 'issue',
      id: issue.id,
      key: issue.key,
      title: 'Cache warmup',
      path: `/work/issue/${issue.key}`,
      data: { priority: 'medium', status: { category: 'todo' }, type: { key: 'task' } },
    });
    expect(await refs.resolve({ id: issue.id })).toMatchObject({ key: issue.key });
    expect(await refs.resolve({ key: 'NOPE-1' })).toBeNull();

    const both = [{ key: issue.key }, { id: issue.id }, { key: 'NOPE-1' }];
    expect(await refs.resolveMany(both)).toHaveLength(1);
    expect(await refs.resolveMany(both, as(users.member))).toHaveLength(1);
    expect(await refs.resolveMany(both, as(users.outsider))).toEqual([]);
    expect(await refs.canView(as(users.member), issue.id)).toBe(true);
    expect(await refs.canView(as(users.outsider), issue.id)).toBe(false);
  });

  it('answers which issues link a page, and registers both with the kernel', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { as, users, sql } = harness;
    const project = await harness.project('LNK', [users.member]);
    const description = {
      type: 'doc' as const,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'pageLink', attrs: { pageId: PAGE_ID, title: 'Runbook' } }],
        },
      ],
    };
    const linking = await harness.issue(project, 'Follow the runbook', { description });
    await harness.issue(project, 'Unrelated');
    const refs = createIssueReferences(sql);
    const found = await refs.referencesTo(as(users.member), { kind: 'page', id: PAGE_ID });
    expect(found.map((item) => item.id)).toEqual([linking.id]);
    expect(await refs.referencesTo(as(users.outsider), { kind: 'page', id: PAGE_ID })).toEqual([]);
    expect(await refs.referencesTo(as(users.member), { kind: 'issue', id: PAGE_ID })).toEqual([]);

    let notes: ModuleContext | undefined;
    loadModules({
      available: [
        {
          id: 'work',
          version: '0.2.0',
          coreApi: '^0.1.0',
          defaultAccess: 'everyone',
          changelog: [],
          register: (moduleCtx) => registerWorkReferences(moduleCtx, sql),
        },
        {
          id: 'notes',
          version: '0.1.0',
          coreApi: '^0.1.0',
          defaultAccess: 'everyone',
          changelog: [],
          register: (moduleCtx) => void (notes = moduleCtx),
        },
      ],
    });
    expect(notes!.entities.has('issue')).toBe(true);
    expect(await notes!.entities.resolve('issue', { key: linking.key })).toMatchObject({
      id: linking.id,
    });
    const groups = await notes!.links.referencesTo(as(users.member), { kind: 'page', id: PAGE_ID });
    expect(groups).toMatchObject([{ source: 'work.issue', moduleId: 'work', label: 'Issues' }]);
  });
  it('finds links at any depth, follows edits and deletes, through the index', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { as, users, sql } = harness;
    const project = await harness.project('IDX', [users.member]);
    const nested = await harness.issue(project, 'Nested link', {
      description: doc({
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [linkTo(OTHER_PAGE), linkTo(LINKED_PAGE)] }],
          },
        ],
      }),
    });
    const edited = await harness.issue(project, 'Edited away', {
      description: doc({ type: 'paragraph', content: [linkTo(LINKED_PAGE)] }),
    });
    const deleted = await harness.issue(project, 'Deleted', {
      description: doc({ type: 'paragraph', content: [linkTo(LINKED_PAGE)] }),
    });
    await harness.issue(project, 'Mentions the id as text', {
      description: doc({ type: 'paragraph', content: [{ type: 'text', text: LINKED_PAGE }] }),
    });
    const refs = createIssueReferences(sql);
    const ids = async (pageId: string) =>
      (await refs.referencesTo(as(users.member), { kind: 'page', id: pageId }))
        .map((item) => item.id)
        .sort();

    expect(await ids(LINKED_PAGE)).toEqual([nested.id, edited.id, deleted.id].sort());
    expect(await ids(OTHER_PAGE)).toEqual([nested.id]);

    await sql`update issues set description = ${JSON.stringify(doc({ type: 'paragraph' }))}::jsonb
      where id = ${edited.id}`;
    await sql`update issues set deleted_at = now() where id = ${deleted.id}`;
    expect(await ids(LINKED_PAGE)).toEqual([nested.id]);

    // Enough issues that a scan would cost more than the index, then the lookup's own plan.
    await sql`
      insert into issues (project_id, number, key, type_id, title, description, status_id, rank)
      select project_id, 1000 + g, 'IDX-' || (1000 + g), type_id, 'Filler ' || g,
        ${JSON.stringify(doc({ type: 'paragraph', content: [linkTo(OTHER_PAGE)] }))}::jsonb,
        status_id, 'n' || translate(lpad(g::text, 6, '0'), '0123456789', 'bcdefghijk') || 'b'
      from issues, generate_series(1, 3000) g
      where id = ${nested.id}`;
    await sql`analyze issues`;
    const [index] = await sql`
      select indexdef from pg_indexes where indexname = 'issues_linked_pages_idx'`;
    expect(index?.['indexdef']).toContain('jsonb_path_ops');
    const plan = await sql<{ 'QUERY PLAN': string }[]>`
      explain select i.id from issues i
      where i.deleted_at is null
        and ${sql.unsafe(LINKED_PAGE_IDS)} @> jsonb_build_array(${LINKED_PAGE}::text)
      order by i.updated_at desc, i.id
      limit 100`;
    expect(plan.map((row) => row['QUERY PLAN']).join('\n')).toContain('issues_linked_pages_idx');
    expect(await ids(LINKED_PAGE)).toEqual([nested.id]);
  });
});
