import { eventually, type CollabTestClient } from '@bemmoly/core/testing';
import { ForbiddenError } from '@bemmoly/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  createRelativePositionFromTypeIndex,
  encodeRelativePosition,
  type Doc,
  type XmlElement,
  type XmlText,
} from 'yjs';
import type { RichText } from '../../../../shared/common.ts';
import type { CommentAnchor, PageComment } from '../../../../shared/comments.ts';
import { startDocsHttp, type DocsHttp } from '../../testing/http-support.ts';
import { startCollabServer, type CollabServer } from '../collab/collab-support.ts';
import { PAGE_FIELD, writeSnapshot } from '../collab/convert.ts';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

const paras = (...lines: string[]) =>
  ({
    type: 'doc',
    content: lines.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
  }) as RichText;
const say = (text: string) => paras(text);
const runOf = (doc: Doc, block: number) =>
  (doc.getXmlFragment(PAGE_FIELD).get(block) as XmlElement).get(0) as XmlText;

/** An anchor made in a person's editor, over `quote` in the n-th paragraph. */
function anchorIn(doc: Doc, block: number, quote: string): CommentAnchor {
  const run = runOf(doc, block);
  const start = run.toString().indexOf(quote);
  const at = (index: number) =>
    Buffer.from(encodeRelativePosition(createRelativePositionFromTypeIndex(run, index))).toString(
      'base64',
    );
  return { from: at(start), to: at(start + quote.length), quote };
}

describe('applying a suggested fix through the live document', () => {
  let harness: DocsHarness | null = null;
  let server: CollabServer | null = null;
  let http: DocsHttp;
  let skipReason = '';
  const clients: CollabTestClient[] = [];

  beforeAll(async () => {
    const started = await startDocsHarness();
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
    server = await startCollabServer(harness);
    http = await startDocsHttp(harness, server.services);
  });

  afterEach(() => {
    for (const client of clients.splice(0)) client.destroy();
  });

  afterAll(async () => {
    await http?.app.close();
    await server?.stop();
    await harness?.stop();
  });

  it('replaces the anchored text for everyone, resolves the thread and refuses a stale fix', async (ctx) => {
    if (!harness || !server) return ctx.skip(skipReason);
    const { users, as } = harness;
    const { services } = server;
    const space = await harness.space('FIX');
    const page = await services.pages.create(as(users.member), { spaceId: space.id, title: 'Ops' });
    const mo = server.open(users.member, page.id);
    const ada = server.open(users.admin, page.id);
    clients.push(mo, ada);
    await Promise.all([mo.synced, ada.synced]);
    writeSnapshot(mo.doc, paras('Rotate the keys every year.', 'Deploy on Monday.'));
    await eventually(() => ada.doc.getXmlFragment(PAGE_FIELD).length === 2);

    const thread = await services.comments.create(as(users.admin), page.id, {
      body: say('Yearly is too slow'),
      anchor: anchorIn(ada.doc, 0, 'every year'),
    });
    const stale = await services.comments.create(as(users.admin), page.id, {
      body: say('Which Monday?'),
      anchor: anchorIn(ada.doc, 1, 'Monday'),
    });
    await services.comments.attachSuggestion(thread.id, {
      replacement: 'every 90 days',
      rationale: 'The security policy says 90 days.',
    });
    await services.comments.attachSuggestion(stale.id, { replacement: 'Tuesday' });

    const applied = await http.call('POST', `/comments/${thread.id}/apply-suggestion`, {
      as: users.member,
    });
    expect(applied.statusCode).toBe(200);
    expect(applied.json<PageComment>()).toMatchObject({
      resolvedBy: users.member,
      aiSuggestion: { replacement: 'every 90 days', appliedBy: users.member },
    });
    await eventually(() => runOf(mo.doc, 0).toString() === 'Rotate the keys every 90 days.');
    await eventually(() => runOf(ada.doc, 0).toString() === 'Rotate the keys every 90 days.');
    const again = await http.call('POST', `/comments/${thread.id}/apply-suggestion`, {
      as: users.member,
    });
    expect(again.statusCode).toBe(409);

    runOf(mo.doc, 1).insert(runOf(mo.doc, 1).toString().indexOf('Monday'), 'next ');
    runOf(mo.doc, 1).delete(runOf(mo.doc, 1).toString().indexOf('Monday') + 1, 2);
    await eventually(() => runOf(ada.doc, 1).toString() === 'Deploy on next Mday.');
    const conflict = await http.call('POST', `/comments/${stale.id}/apply-suggestion`, {
      as: users.member,
    });
    expect(conflict.statusCode).toBe(409);
    expect(runOf(mo.doc, 1).toString()).toBe('Deploy on next Mday.');

    const viewer = await http.call('POST', `/comments/${stale.id}/apply-suggestion`, {
      as: users.viewer,
    });
    expect(viewer.statusCode).toBe(403);
    expect(await harness.auditActions()).toContain('page.comment_fix_applied');
  });

  it('never stores a suggestion in a space excluded from AI', async (ctx) => {
    if (!harness || !server) return ctx.skip(skipReason);
    const { users, as } = harness;
    const { services } = server;
    const space = await harness.space('NOAI');
    await services.spaces.update(as(users.admin), space.id, { aiExcluded: true });
    const page = await services.pages.create(as(users.member), { spaceId: space.id, title: 'HR' });
    const mo = server.open(users.member, page.id);
    clients.push(mo);
    await mo.synced;
    writeSnapshot(mo.doc, paras('Salary bands are private.'));
    const thread = await services.comments.create(as(users.member), page.id, {
      body: say('Check this'),
      anchor: anchorIn(mo.doc, 0, 'private'),
    });
    await expect(
      services.comments.attachSuggestion(thread.id, { replacement: 'confidential' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
