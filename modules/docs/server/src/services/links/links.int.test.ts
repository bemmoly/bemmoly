import type { EntitySummary, RequestContext } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RichText } from '../../../../shared/common.ts';
import type { BacklinksResponse, OutgoingLinksResponse } from '../../../../shared/links.ts';
import { startDocsHttp, type DocsHttp } from '../../testing/http-support.ts';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

/** Work's issues as the kernel's entity registry would answer for them; SEC-1 is admin-only. */
const ISSUES: Record<string, EntitySummary> = {
  'PLT-1': {
    kind: 'issue',
    id: '0193a1b2-0000-7000-8000-000000000001',
    key: 'PLT-1',
    title: 'Fix login',
    path: '/work/issue/PLT-1',
  },
  'SEC-1': {
    kind: 'issue',
    id: '0193a1b2-0000-7000-8000-000000000002',
    key: 'SEC-1',
    title: 'Rotate keys',
    path: '/work/issue/SEC-1',
  },
};
const fakeIssues = (adminId: () => string) => ({
  async resolve(kind: string, ref: { id: string } | { key: string }, ctx?: RequestContext) {
    if (kind !== 'issue') return null;
    const issue = Object.values(ISSUES).find((candidate) =>
      'key' in ref ? candidate.key === ref.key : candidate.id === ref.id,
    );
    if (!issue) return null;
    if (ctx && issue.key === 'SEC-1' && (ctx.actor as { id?: string }).id !== adminId()) {
      return null;
    }
    return issue;
  },
});

const body = (...inline: unknown[]) =>
  ({ type: 'doc', content: [{ type: 'paragraph', content: inline }] }) as RichText;
const pageLink = (pageId: string) => ({ type: 'pageLink', attrs: { pageId, title: 'x' } });
const issue = (key: string) => ({ type: 'issueEmbed', attrs: { key } });
const text = (value: string) => ({ type: 'text', text: value });

describe('the links graph over HTTP', () => {
  let harness: DocsHarness | null = null;
  let http: DocsHttp;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startDocsHarness({ entities: fakeIssues(() => harness!.users.admin) });
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

  it('rewrites body links on every edit and serves both directions', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users, sql } = harness;
    const space = await harness.space('LNK');
    const hidden = await services.spaces.create(as(users.admin), { key: 'HID', name: 'Hidden' });
    const member = as(users.member);
    const target = await services.pages.create(member, { spaceId: space.id, title: 'Runbook' });
    const hub = await services.pages.create(member, { spaceId: space.id, title: 'Hub' });
    const secret = await services.pages.create(as(users.admin), {
      spaceId: hidden.id,
      title: 'Secret',
    });
    await services.pages.update(member, hub.id, {
      snapshot: body(
        text('See '),
        pageLink(target.id),
        issue('PLT-1'),
        issue('SEC-1'),
        issue('NO-9'),
      ),
    });
    await services.pages.update(as(users.admin), secret.id, {
      snapshot: body(pageLink(target.id), issue('PLT-1')),
    });

    const out = await http.call('GET', `/pages/${hub.id}/links`, { as: users.member });
    expect(out.statusCode).toBe(200);
    const edges = out.json<OutgoingLinksResponse>().items;
    expect(edges.map((edge) => [edge.kind, edge.page?.title ?? edge.record?.key])).toEqual([
      ['mention', 'Runbook'],
      ['embed', 'PLT-1'],
    ]);
    const asAdmin = await http.call('GET', `/pages/${hub.id}/links`, { as: users.admin });
    expect(asAdmin.json<OutgoingLinksResponse>().items).toHaveLength(3);

    const back = await http.call('GET', `/pages/${target.id}/backlinks`, { as: users.member });
    expect(back.json<BacklinksResponse>().items.map((page) => page.title)).toEqual(['Hub']);
    const backAdmin = await http.call('GET', `/pages/${target.id}/backlinks`, { as: users.admin });
    expect(
      backAdmin
        .json<BacklinksResponse>()
        .items.map((page) => page.title)
        .sort(),
    ).toEqual(['Hub', 'Secret']);

    const linked = await http.call('GET', '/references?kind=issue&key=PLT-1', { as: users.member });
    expect(linked.json<BacklinksResponse>().items).toMatchObject([
      { pageId: hub.id, spaceKey: 'LNK', kind: 'embed' },
    ]);
    const byId = await http.call('GET', `/references?kind=issue&id=${ISSUES['PLT-1']!.id}`, {
      as: users.outsider,
    });
    expect(byId.json<BacklinksResponse>().items).toEqual([]);

    await services.pages.update(member, hub.id, { snapshot: body(text('No links now')) });
    const rows = await sql`select 1 from links where source_id = ${hub.id}`;
    expect(rows).toHaveLength(0);
    expect(harness.realtime.map((message) => message.kind)).toContain('docs.links');
  });

  it('keeps hand-made links apart and lists records that reference a page', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users, sql } = harness;
    const space = await harness.space('HND');
    const page = await services.pages.create(as(users.member), {
      spaceId: space.id,
      title: 'Spec',
    });
    const other = await services.pages.create(as(users.member), {
      spaceId: space.id,
      title: 'ADR',
    });
    const plt = ISSUES['PLT-1']!.id;
    const put = await http.call('PUT', `/pages/${page.id}/links`, {
      as: users.member,
      body: {
        links: [
          { targetKind: 'issue', targetId: plt },
          { targetKind: 'page', targetId: other.id },
        ],
      },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json<OutgoingLinksResponse>().items.map((edge) => edge.kind)).toEqual([
      'linked',
      'linked',
    ]);
    await services.pages.update(as(users.member), page.id, { snapshot: body(issue('PLT-1')) });
    const kinds = await sql<{ kind: string }[]>`
      select kind from links where source_id = ${page.id} order by kind`;
    expect(kinds.map((row) => row.kind)).toEqual(['embed', 'linked', 'linked']);

    await sql`insert into links (source_kind, source_id, target_kind, target_id, kind)
      values ('issue', ${plt}, 'page', ${page.id}, 'linked')`;
    const refs = await http.call('GET', `/pages/${page.id}/references`, { as: users.viewer });
    expect(refs.json().items).toEqual([{ ...ISSUES['PLT-1'], linkKind: 'linked' }]);
    expect(await harness.auditActions()).toContain('page.links_changed');
  });

  it('refuses what the person may not see or change', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('ACL');
    const page = await services.pages.create(as(users.member), { spaceId: space.id, title: 'P' });
    const status = async (method: 'GET' | 'PUT', url: string, as: string | null, body?: unknown) =>
      (await http.call(method, url, { as, ...(body ? { body } : {}) })).statusCode;
    const none = { links: [] };
    expect(await status('GET', `/pages/${page.id}/links`, null)).toBe(401);
    expect(await status('GET', `/pages/${page.id}/links`, users.outsider)).toBe(403);
    expect(await status('GET', `/pages/${page.id}/backlinks`, users.outsider)).toBe(403);
    expect(await status('GET', `/pages/${page.id}/references`, users.outsider)).toBe(403);
    expect(await status('PUT', `/pages/${page.id}/links`, users.viewer, none)).toBe(403);
    const ghost = { links: [{ targetKind: 'issue', targetId: page.id }] };
    expect(await status('PUT', `/pages/${page.id}/links`, users.member, ghost)).toBe(400);
    const self = { links: [{ targetKind: 'page', targetId: page.id }] };
    expect(await status('PUT', `/pages/${page.id}/links`, users.member, self)).toBe(400);
    const sec = { links: [{ targetKind: 'issue', targetId: ISSUES['SEC-1']!.id }] };
    expect(await status('PUT', `/pages/${page.id}/links`, users.member, sec)).toBe(400);
    expect(await status('GET', '/references?kind=issue&key=NOPE-1', users.member)).toBe(404);
    expect(await status('GET', '/references?kind=issue&key=SEC-1', users.member)).toBe(404);
    expect(
      await status('GET', `/references?kind=issue&key=PLT-1&id=${page.id}`, users.member),
    ).toBe(400);
    expect(await status('GET', `/references?kind=page&id=${page.id}`, users.outsider)).toBe(403);
  });
});
