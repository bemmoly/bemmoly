import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RichText } from '../../../../shared/common.ts';
import type {
  RevisionCompare,
  RevisionDetail,
  RevisionsPage,
} from '../../../../shared/revisions.ts';
import { startDocsHttp, type DocsHttp } from '../../testing/http-support.ts';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

const doc = (...lines: string[]) =>
  ({
    type: 'doc',
    content: lines.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
  }) as RichText;

describe('page revisions over HTTP', () => {
  let harness: DocsHarness | null = null;
  let http: DocsHttp;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startDocsHarness();
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
    http = await startDocsHttp(harness);
  });

  afterAll(async () => {
    await http?.app.close();
    await harness?.stop();
  });

  async function pageWith(key: string, body: RichText) {
    const { services, as, users } = harness!;
    const space = await harness!.space(key);
    const page = await services.pages.create(as(users.member), {
      spaceId: space.id,
      title: 'Plan',
    });
    await services.pages.update(as(users.member), page.id, { snapshot: body });
    return page;
  }

  it('saves, lists, opens, compares and restores versions', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { users, sql } = harness;
    const page = await pageWith('REV', doc('Intro', 'Launch on Monday.', 'Risks', 'Owners'));
    const base = `/pages/${page.id}/revisions`;

    const empty = await http.call('GET', base, { as: users.member });
    expect(empty.statusCode).toBe(200);
    expect(empty.json<RevisionsPage>().items).toEqual([]);

    const first = await http.call('POST', base, { as: users.member, body: { label: 'Draft 1' } });
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ number: 1, kind: 'named', label: 'Draft 1' });
    expect(first.json().authorIds).toEqual([users.member]);

    await harness.services.pages.update(harness.as(users.admin), page.id, {
      snapshot: doc('Owners', 'Intro', 'Launch on Thursday.', 'Risks'),
    });
    const second = await http.call('POST', base, { as: users.admin, body: {} });
    expect(second.json()).toMatchObject({ number: 2, label: null, authorIds: [users.admin] });

    const pageOne = await http.call('GET', `${base}?limit=1`, { as: users.viewer });
    const listed = pageOne.json<RevisionsPage>();
    expect(listed.items.map((item) => item.number)).toEqual([2]);
    const rest = await http.call('GET', `${base}?limit=1&cursor=${listed.nextCursor}`, {
      as: users.viewer,
    });
    expect(rest.json<RevisionsPage>()).toMatchObject({ items: [{ number: 1 }], nextCursor: null });

    const opened = await http.call('GET', `${base}/${first.json().id}`, { as: users.viewer });
    expect(opened.json<RevisionDetail>().snapshot).toEqual(
      doc('Intro', 'Launch on Monday.', 'Risks', 'Owners'),
    );

    const compare = await http.call(
      'GET',
      `${base}/compare?from=${first.json().id}&to=${second.json().id}`,
      { as: users.viewer },
    );
    const diff = compare.json<RevisionCompare>().diff;
    expect(diff.blocks.map((block) => block.op)).toEqual([
      'move',
      'equal',
      'change',
      'equal',
      'move_source',
    ]);
    expect(diff.stats).toMatchObject({ moved: 1, changed: 1 });
    expect(compare.json<RevisionCompare>().from.revision?.number).toBe(1);

    const againstNow = await http.call('GET', `${base}/compare?from=${second.json().id}`, {
      as: users.viewer,
    });
    expect(againstNow.json<RevisionCompare>()).toMatchObject({
      to: { revision: null },
      diff: { stats: { inserted: 0, deleted: 0, changed: 0, moved: 0 } },
    });

    const restored = await http.call('POST', `${base}/${first.json().id}/restore`, {
      as: users.member,
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({
      number: 3,
      kind: 'restore',
      label: 'Restored from v1',
    });
    const [row] = await sql<{ text: string }[]>`select text from pages where id = ${page.id}`;
    expect(row?.text).toBe('Intro\nLaunch on Monday.\nRisks\nOwners');
    expect(await harness.auditActions()).toEqual(
      expect.arrayContaining(['page.revision_saved', 'page.revision_restored']),
    );
    expect(harness.realtime.map((message) => message.kind)).toContain('docs.revisions');
  });

  it('writes a revision when a page is published', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const page = await pageWith('PUB', doc('Ready to ship'));
    await services.status.setStatus(as(users.admin), page.id, { status: 'published' });
    const list = await services.revisions.list(as(users.member), page.id, { limit: 10 });
    expect(list.items).toMatchObject([
      { number: 1, kind: 'publish', createdBy: users.admin, authorIds: [users.member] },
    ]);
  });

  it('writes a periodic revision after 30 minutes of editing, with every editor', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users, sql } = harness;
    const page = await pageWith('PER', doc('First pass'));
    await services.pages.update(as(users.admin), page.id, { snapshot: doc('Second pass') });
    expect((await services.revisions.list(as(users.member), page.id, { limit: 5 })).items).toEqual(
      [],
    );
    await sql`update pages set revision_pending_since = now() - interval '31 minutes'
      where id = ${page.id}`;
    await services.pages.update(as(users.member), page.id, { snapshot: doc('Third pass') });
    const [periodic] = (await services.revisions.list(as(users.member), page.id, { limit: 5 }))
      .items;
    expect(periodic).toMatchObject({ kind: 'periodic', createdBy: null, wordCount: 2 });
    expect(periodic?.authorIds.sort()).toEqual([users.member, users.admin].sort());
    await services.pages.update(as(users.member), page.id, { snapshot: doc('Fourth pass') });
    const after = await services.revisions.list(as(users.member), page.id, { limit: 5 });
    expect(after.items).toHaveLength(1);
  });

  it('refuses people who may not see or edit the page', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { users } = harness;
    const page = await pageWith('DNY', doc('Private'));
    const other = await pageWith('OTH', doc('Other'));
    const base = `/pages/${page.id}/revisions`;
    const saved = await http.call('POST', base, { as: users.member, body: {} });
    const id = saved.json().id as string;

    expect((await http.call('GET', base, { as: null })).statusCode).toBe(401);
    expect((await http.call('GET', base, { as: users.outsider })).statusCode).toBe(403);
    expect((await http.call('GET', `${base}/${id}`, { as: users.outsider })).statusCode).toBe(403);
    expect((await http.call('POST', base, { as: users.viewer, body: {} })).statusCode).toBe(403);
    expect(
      (await http.call('POST', `${base}/${id}/restore`, { as: users.viewer })).statusCode,
    ).toBe(403);
    expect(
      (await http.call('GET', `/pages/${other.id}/revisions/${id}`, { as: users.admin }))
        .statusCode,
    ).toBe(404);
    expect(
      (await http.call('GET', `${base}/compare?from=nope`, { as: users.member })).statusCode,
    ).toBe(400);
    expect(
      (await http.call('POST', base, { as: users.member, body: { label: 'x'.repeat(121) } }))
        .statusCode,
    ).toBe(400);
  });
});
