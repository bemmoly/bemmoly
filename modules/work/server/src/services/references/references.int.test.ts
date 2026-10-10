import { loadModules, type ModuleContext } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startWorkHarness, type WorkHarness } from '../int-support.ts';
import { createIssueReferences, registerWorkReferences } from './index.ts';

/*
 * Issues as other modules see them through the kernel: by key or id with
 * what an embed shows, filtered to the projects a person may view, and the
 * issues whose description links a page.
 */

const PAGE_ID = '0192f3a0-0000-7000-8000-00000000beef';

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
});
