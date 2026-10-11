import type { DomainEvent, EventBus } from '@bemmoly/core';
import { notificationRequestedPayloadSchema } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createRelativePositionFromTypeIndex,
  encodeRelativePosition,
  type XmlElement,
  type XmlText,
} from 'yjs';
import type { RichText } from '../../../../shared/common.ts';
import type { CommentAnchor, CommentsResponse, PageComment } from '../../../../shared/comments.ts';
import { startDocsHttp, type DocsHttp } from '../../testing/http-support.ts';
import { PAGE_FIELD } from '../collab/convert.ts';
import { readPageDoc } from '../collab/document.ts';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

const paras = (...lines: string[]) =>
  ({
    type: 'doc',
    content: lines.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
  }) as RichText;
const say = (text: string, mentions: { id: string; label: string }[] = []) => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text }, ...mentions.map((attrs) => ({ type: 'mention', attrs }))],
    },
  ],
});

describe('page comments over HTTP', () => {
  let harness: DocsHarness | null = null;
  let http: DocsHttp;
  let skipReason = '';
  const events: DomainEvent[] = [];
  const bus = { publish: async (event: DomainEvent) => void events.push(event) } as EventBus;

  beforeAll(async () => {
    const started = await startDocsHarness({ events: bus });
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

  const notices = () =>
    events.map((event) => {
      expect(event.transaction).toBeDefined();
      const payload = notificationRequestedPayloadSchema.parse(event.payload);
      return { kind: payload.kind, to: payload.recipientIds, key: payload.dedupeKey };
    });

  /** An anchor over `quote` in the n-th paragraph of the stored page, as the editor sends it. */
  async function anchorOn(pageId: string, block: number, quote: string): Promise<CommentAnchor> {
    const doc = await readPageDoc(harness!.sql, pageId);
    const run = (doc.getXmlFragment(PAGE_FIELD).get(block) as XmlElement).get(0) as XmlText;
    const start = run.toString().indexOf(quote);
    const at = (index: number) =>
      Buffer.from(encodeRelativePosition(createRelativePositionFromTypeIndex(run, index))).toString(
        'base64',
      );
    const anchor = { from: at(start), to: at(start + quote.length), quote };
    doc.destroy();
    return anchor;
  }

  it('runs threads with mentions, replies, inline anchors, resolve and reopen', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('CMT');
    const page = await services.pages.create(as(users.member), { spaceId: space.id, title: 'RFC' });
    await services.pages.update(as(users.member), page.id, {
      snapshot: paras('Ship the importer on Monday.', 'Owners review it.'),
    });
    const base = `/pages/${page.id}/comments`;
    events.length = 0;

    const opened = await http.call('POST', base, {
      as: users.admin,
      body: {
        body: say('Can you check this, ', [
          { id: users.viewer, label: 'vi' },
          { id: users.outsider, label: 'otto' },
        ]),
      },
    });
    expect(opened.statusCode).toBe(201);
    const thread = opened.json<PageComment>();
    expect(thread).toMatchObject({ parentId: null, anchor: null, anchorStatus: null });
    expect(thread.author).toEqual({ id: users.admin, name: 'ada' });
    expect(notices()).toEqual([
      { kind: 'mention', to: [users.viewer], key: `page-comment:${thread.id}:mention` },
      { kind: 'comment', to: [users.member], key: `page-comment:${thread.id}:comment` },
    ]);

    events.length = 0;
    const reply = await http.call('POST', base, {
      as: users.member,
      body: { body: say('Done.'), parentId: thread.id },
    });
    expect(reply.statusCode).toBe(201);
    expect(notices()).toEqual([
      { kind: 'comment', to: [users.admin], key: `page-comment:${reply.json().id}:comment` },
    ]);

    const anchor = await anchorOn(page.id, 0, 'importer');
    const inline = await http.call('POST', base, {
      as: users.member,
      body: { body: say('Which importer?'), anchor },
    });
    expect(inline.json<PageComment>()).toMatchObject({ anchor, anchorStatus: 'anchored' });

    await services.pages.update(as(users.member), page.id, {
      snapshot: paras('Ship the importer on Monday.', 'Owners review it weekly.'),
    });
    let listed = await http.call('GET', base, { as: users.viewer });
    const statusOf = (response: typeof listed, id: string) =>
      response.json<CommentsResponse>().items.find((item) => item.id === id)?.anchorStatus;
    expect(statusOf(listed, inline.json().id)).toBe('anchored');
    await services.pages.update(as(users.member), page.id, {
      snapshot: paras('Ship the exporter on Monday.', 'Owners review it weekly.'),
    });
    listed = await http.call('GET', base, { as: users.viewer });
    expect(statusOf(listed, inline.json().id)).toBe('text_changed');
    expect(listed.json<CommentsResponse>().items.map((item) => item.id)).toEqual([
      thread.id,
      reply.json().id,
      inline.json().id,
    ]);

    const resolved = await http.call('POST', `/comments/${thread.id}/resolve`, {
      as: users.member,
    });
    expect(resolved.json<PageComment>()).toMatchObject({ resolvedBy: users.member });
    const open = await http.call('GET', `${base}?resolved=false`, { as: users.member });
    expect(open.json<CommentsResponse>().items.map((item) => item.id)).toEqual([inline.json().id]);
    const closed = await http.call('GET', `${base}?resolved=true`, { as: users.member });
    expect(closed.json<CommentsResponse>().items).toHaveLength(2);
    const reopened = await http.call('POST', `/comments/${thread.id}/reopen`, { as: users.admin });
    expect(reopened.json<PageComment>()).toMatchObject({ resolvedAt: null, resolvedBy: null });

    events.length = 0;
    const edited = await http.call('PATCH', `/comments/${reply.json().id}`, {
      as: users.member,
      body: { body: say('Done, see ', [{ id: users.viewer, label: 'vi' }]) },
    });
    expect(edited.statusCode, edited.body).toBe(200);
    expect(edited.json<PageComment>().editedAt).not.toBeNull();
    expect(notices().map((notice) => [notice.kind, notice.to])).toEqual([
      ['mention', [users.viewer]],
    ]);

    const removed = await http.call('DELETE', `/comments/${thread.id}`, { as: users.admin });
    expect(removed.statusCode).toBe(204);
    const left = await http.call('GET', base, { as: users.member });
    expect(left.json<CommentsResponse>().items.map((item) => item.id)).toEqual([inline.json().id]);
    expect(await harness.auditActions()).toEqual(
      expect.arrayContaining([
        'page.comment_created',
        'page.comment_resolved',
        'page.comment_reopened',
        'page.comment_edited',
        'page.comment_deleted',
      ]),
    );
    expect(harness.realtime.map((message) => message.kind)).toContain('docs.comments');
  });

  it('refuses what the person may not do', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('CDN');
    const page = await services.pages.create(as(users.member), { spaceId: space.id, title: 'P' });
    const other = await services.pages.create(as(users.member), { spaceId: space.id, title: 'Q' });
    const base = `/pages/${page.id}/comments`;
    const body = { body: say('Hello') };
    const mine = (await http.call('POST', base, { as: users.admin, body })).json<PageComment>();
    const reply = (
      await http.call('POST', base, { as: users.member, body: { ...body, parentId: mine.id } })
    ).json<PageComment>();
    const code = async (...args: Parameters<DocsHttp['call']>) =>
      (await http.call(...args)).statusCode;

    expect(await code('GET', base, { as: null })).toBe(401);
    expect(await code('GET', base, { as: users.outsider })).toBe(403);
    expect(await code('POST', base, { as: users.viewer, body })).toBe(403);
    expect(await code('PATCH', `/comments/${mine.id}`, { as: users.member, body })).toBe(403);
    expect(await code('POST', `/comments/${mine.id}/resolve`, { as: users.viewer })).toBe(403);
    expect(await code('POST', `/comments/${reply.id}/resolve`, { as: users.member })).toBe(400);
    expect(await code('DELETE', `/comments/${mine.id}`, { as: users.viewer })).toBe(403);
    expect(await code('POST', `/comments/${mine.id}/apply-suggestion`, { as: users.member })).toBe(
      400,
    );
    const nested = { ...body, parentId: reply.id };
    expect(await code('POST', base, { as: users.member, body: nested })).toBe(400);
    const elsewhere = { ...body, parentId: mine.id };
    expect(
      await code('POST', `/pages/${other.id}/comments`, { as: users.member, body: elsewhere }),
    ).toBe(400);
    expect(await code('POST', base, { as: users.member, body: { body: { type: 'p' } } })).toBe(400);
    expect(
      await code('PATCH', '/comments/0193a1b2-0000-7000-8000-00000000dead', {
        as: users.member,
        body,
      }),
    ).toBe(404);
  });
});
