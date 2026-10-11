import type { EntitySummary } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RichText } from '../../../../shared/common.ts';
import type { DocsServiceDeps } from '../index.ts';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

/*
 * A page made with a body (a template, a paste, an import) links its issues at
 * once, and "Referenced in" adds what other modules answer through the kernel's
 * reference sources, so an issue linking the page shows there.
 */

const ISSUE: EntitySummary = {
  kind: 'issue',
  id: '0192f3a0-0000-7000-8000-0000000000a1',
  key: 'PLT-7',
  title: 'Warm the cache',
  path: '/work/issue/PLT-7',
  data: { status: { name: 'In review', category: 'in_progress' } },
};
const LINKING: EntitySummary = { ...ISSUE, id: ISSUE.id.replace('a1', 'b2'), key: 'PLT-8' };

describe('page references from other modules', () => {
  let harness: DocsHarness | null = null;
  let skipReason = '';
  const entities: NonNullable<DocsServiceDeps['entities']> = {
    resolve: async (_kind, ref) =>
      [ISSUE, LINKING].find((issue) =>
        'key' in ref ? issue.key === ref.key : issue.id === ref.id,
      ) ?? null,
  };
  const links: NonNullable<DocsServiceDeps['links']> = {
    referencesTo: async (_ctx, target) => [
      { source: 'docs.page', label: 'Linked docs', moduleId: 'docs', items: [] },
      {
        source: 'work.issue',
        label: 'Issues',
        moduleId: 'work',
        items: target.kind === 'page' ? [LINKING] : [],
      },
    ],
  };

  beforeAll(async () => {
    const started = await startDocsHarness({ entities, links });
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });

  afterAll(async () => {
    await harness?.stop();
  });

  it('links a new page’s issue embeds and lists issues that link the page', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users, sql } = harness;
    const space = await harness.space('SRC');
    const snapshot = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'issueEmbed', attrs: { key: 'PLT-7' } }] }],
    } as RichText;
    const page = await services.pages.create(as(users.member), {
      spaceId: space.id,
      title: 'Cache plan',
      snapshot,
    });
    const edges = await sql<{ target_id: string; kind: string }[]>`
      select target_id, kind from links where source_id = ${page.id}`;
    expect(edges).toEqual([{ target_id: ISSUE.id, kind: 'embed' }]);

    const outgoing = await services.links.outgoing(as(users.member), page.id);
    expect(outgoing.items).toMatchObject([
      { record: { key: 'PLT-7', data: { status: { name: 'In review' } } }, kind: 'embed' },
    ]);

    const references = await services.links.references(as(users.member), page.id);
    expect(references.items).toEqual([
      {
        kind: 'issue',
        id: LINKING.id,
        key: 'PLT-8',
        title: LINKING.title,
        path: LINKING.path,
        data: LINKING.data,
        linkKind: 'mention',
      },
    ]);
  });
});
