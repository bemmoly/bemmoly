import {
  createTestAi,
  eventually,
  type CollabTestClient,
  type TestAi,
} from '@bemmoly/core/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createRelativePositionFromTypeIndex,
  encodeRelativePosition,
  type Doc,
  type XmlElement,
  type XmlText,
} from 'yjs';
import type { RichText } from '../../../../shared/common.ts';
import type { CommentAnchor, PageComment } from '../../../../shared/comments.ts';
import { addEditorPrompts } from '../../testing/editor-prompts.ts';
import { lines, startEditorAiHttp, type EditorAiHttp } from '../../testing/editor-ai-http.ts';
import { startCollabServer, type CollabServer } from '../collab/collab-support.ts';
import { PAGE_FIELD, writeSnapshot } from '../collab/convert.ts';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

const paras = (...texts: string[]) =>
  ({
    type: 'doc',
    content: texts.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
  }) as RichText;
const runOf = (doc: Doc, block: number) =>
  (doc.getXmlFragment(PAGE_FIELD).get(block) as XmlElement).get(0) as XmlText;

function anchorIn(doc: Doc, block: number, quote: string): CommentAnchor {
  const run = runOf(doc, block);
  const start = run.toString().indexOf(quote);
  const at = (index: number) =>
    Buffer.from(encodeRelativePosition(createRelativePositionFromTypeIndex(run, index))).toString(
      'base64',
    );
  return { from: at(start), to: at(start + quote.length), quote };
}

const promptText = (ai: TestAi) => JSON.stringify(ai.calls.at(-1)?.prompt ?? '');

describe('AI inside the editor', () => {
  let harness: DocsHarness | null = null;
  let server: CollabServer | null = null;
  let http: EditorAiHttp;
  let ai: TestAi;
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
    ai = createTestAi();
    addEditorPrompts(ai);
    http = await startEditorAiHttp(harness, ai, server.services);
  });

  beforeEach(() => ai?.setPolicy({ enabled: true, shareContent: true, excludedSpaceIds: [] }));
  afterEach(() => {
    for (const client of clients.splice(0)) client.destroy();
  });
  afterAll(async () => {
    await http?.app.close();
    await server?.stop();
    await harness?.stop();
  });

  async function livePage(key: string, ...texts: string[]) {
    const { users, as } = harness!;
    const space = await harness!.space(key);
    const page = await server!.services.pages.create(as(users.member), {
      spaceId: space.id,
      title: 'Session store',
    });
    const mo = server!.open(users.member, page.id);
    clients.push(mo);
    await mo.synced;
    writeSnapshot(mo.doc, paras(...texts));
    return { space, page, mo };
  }

  it('continues a line on the fast role and records the run', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { page } = await livePage('GHOST', 'Sessions move to Postgres');
    ai.queue({ text: ' behind a flag.\nAnd more.' });
    const response = await http.call(`/pages/${page.id}/completions`, {
      as: harness.users.member,
      body: { before: 'Sessions move to Postgres', after: '' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ text: ' behind a flag.' });
    expect(ai.runs.at(-1)).toMatchObject({ purpose: 'docs.autocomplete', role: 'fast' });
    expect(promptText(ai)).toContain('Sessions move to Postgres');
  });

  it('refuses honestly: readers, AI off, an excluded space and content not shared', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { users, as } = harness;
    const { page, space } = await livePage('NOPE', 'Salary bands');
    const ask = (as_: string) =>
      http.call(`/pages/${page.id}/completions`, { as: as_, body: { before: 'Salary bands' } });
    const calls = ai.calls.length;

    expect((await ask(users.viewer)).statusCode).toBe(403);
    ai.setPolicy({ enabled: false });
    const off = await ask(users.member);
    expect([off.statusCode, off.json().details]).toEqual([403, { reason: 'ai_off' }]);
    ai.setPolicy({ enabled: true, shareContent: false });
    expect((await ask(users.member)).json().details).toEqual({ reason: 'excluded' });
    ai.setPolicy({ shareContent: true, excludedSpaceIds: [space.id] });
    expect((await ask(users.member)).json().details).toEqual({ reason: 'excluded' });
    ai.setPolicy({ excludedSpaceIds: [] });
    await server!.services.spaces.update(as(users.admin), space.id, { aiExcluded: true });
    expect((await ask(users.member)).json().details).toEqual({ reason: 'excluded' });
    expect(ai.calls.length).toBe(calls);
  });

  it('refuses a person whose role may no longer use AI assist', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { users, sql } = harness;
    const { page } = await livePage('ROLE', 'Rollout plan');
    const toggle = (allowed: boolean) => sql`
      update role_capabilities set allowed = ${allowed}
      where capability = 'ai.assist.use'
        and role_id = (select role_id from users where id = ${users.member})`;
    const calls = ai.calls.length;
    await toggle(false);
    try {
      const response = await http.call(`/pages/${page.id}/completions`, {
        as: users.member,
        body: { before: 'Rollout plan' },
      });
      expect(response.statusCode).toBe(403);
      expect(ai.calls.length).toBe(calls);
    } finally {
      await toggle(true);
    }
  });

  it('streams an /ai write as NDJSON and changes nothing on the page', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { page, mo } = await livePage('WRITE', 'we moves sessions to postgres');
    ai.queue({ text: 'We move sessions to Postgres.' });
    const response = await http.call(`/pages/${page.id}/ai-writes`, {
      as: harness.users.member,
      body: {
        command: 'improve',
        targetText: 'we moves sessions to postgres',
        sectionText: 'we moves sessions to postgres',
        heading: 'Rollout',
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/x-ndjson');
    const events = lines(response);
    const written = events
      .filter((event) => event['type'] === 'text')
      .map((event) => event['text'])
      .join('');
    expect(written).toBe('We move sessions to Postgres.');
    expect(events.at(-1)).toEqual({ type: 'done', runId: expect.any(String) });
    expect(ai.runs.at(-1)).toMatchObject({ purpose: 'docs.write' });
    expect(promptText(ai)).toContain('Rollout');
    expect(runOf(mo.doc, 0).toString()).toBe('we moves sessions to postgres');
  });

  it('ends a write that fails part way with an error line, and refuses an empty one', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { page } = await livePage('FAIL', 'Rotate the keys.');
    ai.queue({ error: new Error('connection reset') });
    const failed = await http.call(`/pages/${page.id}/ai-writes`, {
      as: harness.users.member,
      body: { command: 'shorten', targetText: 'Rotate the keys.' },
    });
    const events = failed.statusCode === 200 ? lines(failed) : [failed.json()];
    expect(JSON.stringify(events)).toMatch(/error|provider/);
    const empty = await http.call(`/pages/${page.id}/ai-writes`, {
      as: harness.users.member,
      body: { command: 'improve' },
    });
    expect(empty.statusCode).toBe(400);
  });

  it('summarizes open threads, leaving out people who opted out', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { users, as } = harness;
    const { page, mo } = await livePage('ASK', 'Deploy on Monday.');
    const say = (text: string) => paras(text);
    const comments = server!.services.comments;
    await comments.create(as(users.member), page.id, {
      body: say('Which Monday?'),
      anchor: anchorIn(mo.doc, 0, 'Monday'),
    });
    await comments.create(as(users.admin), page.id, { body: say('Who signs off?') });
    ai.setPolicy({ optedOutUserIds: [users.admin] });
    ai.queue({ text: '- Which Monday? (member)' });
    const response = await http.call(`/pages/${page.id}/ai-writes`, {
      as: users.member,
      body: { command: 'summarize-comments' },
    });
    expect(response.statusCode).toBe(200);
    expect(promptText(ai)).toContain('Which Monday?');
    expect(promptText(ai)).not.toContain('Who signs off?');
    ai.setPolicy({ optedOutUserIds: [] });
  });

  it('suggests a fix on a thread that Apply fix lands for everyone, and a stale one is a 409', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { users, as } = harness;
    const { page, mo } = await livePage('FIX', 'Rotate the keys every year.', 'Deploy on Monday.');
    const ada = server!.open(users.admin, page.id);
    clients.push(ada);
    await ada.synced;
    await eventually(() => ada.doc.getXmlFragment(PAGE_FIELD).length === 2);
    const comments = server!.services.comments;
    const thread = await comments.create(as(users.admin), page.id, {
      body: paras('Yearly is too slow; policy says 90 days'),
      anchor: anchorIn(ada.doc, 0, 'every year'),
    });

    ai.queue({ object: { replacement: 'every 90 days', rationale: 'Policy says 90 days.' } });
    const suggested = await http.call(`/comments/${thread.id}/suggest-fix`, { as: users.member });
    expect(suggested.statusCode).toBe(200);
    expect(suggested.json<PageComment>().aiSuggestion).toMatchObject({
      replacement: 'every 90 days',
      rationale: 'Policy says 90 days.',
      appliedAt: null,
    });
    expect(promptText(ai)).toContain('every year');
    expect(ai.runs.at(-1)).toMatchObject({ purpose: 'docs.comment_fix' });

    const applied = await http.call(`/comments/${thread.id}/apply-suggestion`, {
      as: users.member,
    });
    expect(applied.statusCode).toBe(200);
    await eventually(() => runOf(ada.doc, 0).toString() === 'Rotate the keys every 90 days.');

    const stale = await comments.create(as(users.admin), page.id, {
      body: paras('Which Monday?'),
      anchor: anchorIn(ada.doc, 1, 'Monday'),
    });
    ai.queue({ object: { replacement: 'Monday 14 October', rationale: 'Names the day.' } });
    await http.call(`/comments/${stale.id}/suggest-fix`, { as: users.member });
    const run = runOf(mo.doc, 1);
    run.delete(run.toString().indexOf('Monday'), 6);
    run.insert(run.toString().length - 1, 'Tuesday');
    await eventually(() => runOf(ada.doc, 1).toString() === 'Deploy on Tuesday.');
    const conflict = await http.call(`/comments/${stale.id}/apply-suggestion`, {
      as: users.member,
    });
    expect(conflict.statusCode).toBe(409);
    expect(runOf(mo.doc, 1).toString()).toBe('Deploy on Tuesday.');
  });

  it('refuses a fix for a page-level thread', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { users, as } = harness;
    const { page } = await livePage('PAGEC', 'Hello there.');
    const note = await server!.services.comments.create(as(users.member), page.id, {
      body: paras('General note'),
    });
    const response = await http.call(`/comments/${note.id}/suggest-fix`, { as: users.member });
    expect(response.statusCode).toBe(400);
  });
});
