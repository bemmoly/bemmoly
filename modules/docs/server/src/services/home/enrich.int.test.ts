import type { EntityLookup, EntitySummary, RequestContext } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Doc } from 'yjs';
import type { RichText } from '../../../../shared/common.ts';
import type { HomePage } from '../../../../shared/home.ts';
import { writeSnapshot } from '../collab/convert.ts';
import { extractPage } from '../collab/extract.ts';
import { createDocsServices, type DocsServiceDeps } from '../index.ts';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

/*
 * The Docs home's rows and space cards carry breadcrumbs, the last body
 * editor, issue keys and contributors, each list in a fixed number of
 * queries: the issue lookup runs once per list, whatever its length.
 */

const ISSUES: Record<string, string> = {
  'PLT-1': '0192f3a0-0000-7000-8000-000000000001',
  'PLT-2': '0192f3a0-0000-7000-8000-000000000002',
};
const HIDDEN_FROM_MEMBERS = 'PLT-2';
const summary = (key: string): EntitySummary => ({
  kind: 'issue',
  id: ISSUES[key]!,
  key,
  title: `Issue ${key}`,
  path: `/work/issues/${key}`,
});
const find = (ref: EntityLookup) =>
  Object.keys(ISSUES).find((key) => ('key' in ref ? ref.key === key : ref.id === ISSUES[key]));

describe('docs home enrichment', () => {
  let harness: DocsHarness | null = null;
  let skipReason = '';
  let member = '';
  const lookups: number[] = [];
  const visibleTo = (ctx: RequestContext | undefined, key: string) =>
    !ctx || ctx.actor.kind !== 'user' || ctx.actor.id !== member || key !== HIDDEN_FROM_MEMBERS;
  const entities: NonNullable<DocsServiceDeps['entities']> = {
    resolve: async (_kind, ref, ctx) => {
      const key = find(ref);
      return key && visibleTo(ctx, key) ? summary(key) : null;
    },
    resolveMany: async (_kind, refs, ctx) => {
      lookups.push(refs.length);
      return refs
        .map(find)
        .filter((key): key is string => key !== undefined && visibleTo(ctx, key))
        .map(summary);
    },
    has: (kind) => kind === 'issue',
  };

  beforeAll(async () => {
    const started = await startDocsHarness({ entities });
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
    member = harness.users.member;
  });

  afterAll(async () => {
    await harness?.stop();
  });

  it('carries ancestors, the last body editor and visible issue keys', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users, sql } = harness;
    const space = await harness.space('ENR');
    const make = (title: string, parentId: string | null) =>
      services.pages.create(as(member), { spaceId: space.id, parentId, title });
    const root = await make('Engineering', null);
    const child = await make('Architecture', root.id);
    const rfc = await make('Cache RFC', child.id);
    const body = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'issueEmbed', attrs: { key: 'PLT-1' } }] },
        { type: 'issueTable', attrs: { query: 'key in (PLT-2, NOPE-4)', title: 'Rollout' } },
      ],
    } as RichText;
    const doc = new Doc();
    writeSnapshot(doc, body);
    const deps = { database: sql, entities };
    await extractPage(deps, { id: rfc.id, doc, editors: [{ kind: 'user', id: users.admin }] });

    const edges = await sql<{ target_id: string; kind: string }[]>`
      select target_id, kind from links where source_id = ${rfc.id} order by kind`;
    expect(edges).toEqual([
      { target_id: ISSUES['PLT-1'], kind: 'embed' },
      { target_id: ISSUES['PLT-2'], kind: 'mention' },
    ]);

    lookups.length = 0;
    const recent = await services.home.recent(as(member), { limit: 20, mine: false });
    expect(lookups).toEqual([2]);
    const row = recent.items.find((item) => item.id === rfc.id)!;
    expect(row.ancestors.map((crumb) => crumb.title)).toEqual(['Engineering', 'Architecture']);
    expect(row.lastEditor).toEqual({ id: users.admin, name: 'ada' });
    expect(row.issueKeys).toEqual(['PLT-1']);
    const top = recent.items.find((item) => item.id === root.id)!;
    expect(top).toMatchObject({ ancestors: [], issueKeys: [], lastEditor: { id: member } });

    const forAdmin = await services.home.recent(as(users.admin), { limit: 20, mine: false });
    const adminRow = forAdmin.items.find((item) => item.id === rfc.id);
    expect(adminRow?.issueKeys.sort()).toEqual(['PLT-1', 'PLT-2']);

    await services.starsLabels.star(as(member), rfc.id, true);
    const starred = await services.home.starred(as(member), { limit: 20 });
    expect(starred.items[0]).toMatchObject({ id: rfc.id, issueKeys: ['PLT-1'] });

    await services.status.setReviewers(as(member), rfc.id, { reviewers: [member] });
    await services.status.setStatus(as(member), rfc.id, { status: 'in_review' });
    const attention = await services.home.attention(as(member), { limit: 10 });
    const review = attention.items.find((item) => item.page.id === rfc.id);
    expect(review?.page).toMatchObject({
      ancestors: [{ title: 'Engineering' }, { title: 'Architecture' }],
      lastEditor: { id: users.admin },
      issueKeys: ['PLT-1'],
    });
  });

  it('gives space cards their recent contributors and member count', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const spaces = await services.spaces.list(as(users.admin), { limit: 50, archived: false });
    const card = spaces.items.find((space) => space.key === 'ENR')!;
    expect(card.memberCount).toBe(3);
    expect(card.contributors.map((person) => person.id)).toEqual([users.admin, member]);
    const fresh = await services.spaces.create(as(users.admin), { key: 'NEW', name: 'New' });
    expect(fresh).toMatchObject({ contributors: [], memberCount: 1 });
  });

  it('leaves issue keys empty with Work off, without asking anyone', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const workOff = createDocsServices({ database: harness.sql });
    lookups.length = 0;
    const recent = await workOff.home.recent(harness.as(member), { limit: 20, mine: false });
    expect(recent.items.length).toBeGreaterThan(0);
    expect(recent.items.every((item: HomePage) => item.issueKeys.length === 0)).toBe(true);
    expect(lookups).toEqual([]);
  });
});
