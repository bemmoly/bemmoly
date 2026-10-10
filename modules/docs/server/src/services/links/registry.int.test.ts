import { loadModules, type BemmolyModule, type ModuleContext } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import docs from '../../../../module.ts';
import type { RichText } from '../../../../shared/common.ts';
import { createDocsServices } from '../index.ts';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

const ISSUE_ID = '0193a1b2-0000-7000-8000-0000000000aa';

/**
 * A stand-in for Work that knows nothing of Docs: it registers its issues as an entity and asks
 * the kernel what points at one, exactly as Work's issue screen would for "Linked docs".
 */
function trackerModule(capture: (ctx: ModuleContext) => void): BemmolyModule {
  return {
    id: 'tracker',
    version: '0.1.0',
    coreApi: '^0.1.0',
    defaultAccess: 'everyone',
    changelog: [],
    register(ctx) {
      capture(ctx);
      ctx.entities.add({
        kind: 'issue',
        renderer: 'tracker.issue',
        resolve: async (ref) =>
          ('key' in ref && ref.key === 'PLT-7') || ('id' in ref && ref.id === ISSUE_ID)
            ? { kind: 'issue', id: ISSUE_ID, key: 'PLT-7', title: 'Login', path: '/t/PLT-7' }
            : null,
        canView: async () => true,
      });
    },
  };
}

describe('Docs in the kernel reference registries', () => {
  let harness: DocsHarness | null = null;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startDocsHarness();
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });

  afterAll(async () => {
    await harness?.stop();
  });

  it('answers another module with linked docs and resolves pages for it', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    let tracker: ModuleContext | undefined;
    loadModules({
      available: [docs, trackerModule((captured) => (tracker = captured))],
      enabled: ['docs', 'tracker'],
      database: harness.sql,
    });
    const space = await harness.space('REG');
    const spec = await services.pages.create(as(users.member), {
      spaceId: space.id,
      title: 'Spec',
    });
    await harness.sql`insert into links (source_kind, source_id, target_kind, target_id, kind)
      values ('page', ${spec.id}, 'issue', ${ISSUE_ID}, 'embed')`;

    const groups = await tracker!.links.referencesTo(as(users.member), {
      kind: 'issue',
      id: ISSUE_ID,
    });
    expect(groups).toEqual([
      {
        source: 'docs.page',
        label: 'Linked docs',
        moduleId: 'docs',
        items: [
          { kind: 'page', id: spec.id, key: 'REG', title: 'Spec', path: `/docs/p/${spec.id}` },
        ],
      },
    ]);
    expect(
      await tracker!.links.referencesTo(as(users.outsider), { kind: 'issue', id: ISSUE_ID }),
    ).toEqual([]);

    expect(await tracker!.entities.resolve('page', { id: spec.id }, as(users.viewer))).toEqual({
      kind: 'page',
      id: spec.id,
      title: 'Spec',
      path: `/docs/p/${spec.id}`,
    });
    expect(await tracker!.entities.resolve('page', { id: spec.id }, as(users.outsider))).toBeNull();
    expect(await tracker!.entities.resolve('page', { id: 'not-a-uuid' })).toBeNull();
  });

  it('turns an embedded issue key into an edge through the registry', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { as, users } = harness;
    let docsCtx: ModuleContext | undefined;
    const spy: BemmolyModule = { ...docs, register: (c) => void (docsCtx = c) };
    loadModules({
      available: [spy, trackerModule(() => undefined)],
      enabled: ['docs', 'tracker'],
    });
    const services = createDocsServices({ database: harness.sql, entities: docsCtx!.entities });
    const space = await harness.space('KEY');
    const page = await services.pages.create(as(users.member), { spaceId: space.id, title: 'P' });
    const snapshot = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'issueEmbed', attrs: { key: 'PLT-7' } }] }],
    } as RichText;
    await services.pages.update(as(users.member), page.id, { snapshot });
    const rows = await harness.sql<{ target_id: string; kind: string }[]>`
      select target_id, kind from links where source_id = ${page.id}`;
    expect(rows).toEqual([{ target_id: ISSUE_ID, kind: 'embed' }]);
  });
});
