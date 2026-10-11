import type { RequestContext } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RichText } from '../../../../shared/common.ts';
import type { ImportResult } from '../../../../shared/transfer.ts';
import { importJob } from '../../config/jobs.ts';
import { startDocsHttp, type DocsHttp } from '../../testing/http-support.ts';
import { readZip } from '../../testing/read-zip.ts';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';

const ISSUE = {
  kind: 'issue',
  id: '0193a1b2-0000-7000-8000-0000000000b1',
  key: 'PLT-1',
  title: 'Fix login',
  path: '/work/issue/PLT-1',
};
const entities = {
  resolve: async (kind: string, ref: { id: string } | { key: string }, _ctx?: RequestContext) =>
    kind === 'issue' && 'key' in ref && ref.key === 'PLT-1' ? ISSUE : null,
};
const queued: { name: string; payload: unknown; key: string | undefined }[] = [];
const jobs = {
  send: async (name: string, payload?: unknown, options?: { idempotencyKey?: string }) => {
    queued.push({ name, payload, key: options?.idempotencyKey });
    return `job-${queued.length}`;
  },
};

const body = (...blocks: unknown[]) => ({ type: 'doc', content: blocks }) as RichText;
const para = (...content: unknown[]) => ({ type: 'paragraph', content });
const text = (value: string) => ({ type: 'text', text: value });

describe('exports and imports over HTTP', () => {
  let harness: DocsHarness | null = null;
  let http: DocsHttp;
  let skipReason = '';

  beforeAll(async () => {
    const started = await startDocsHarness({ entities, jobs });
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

  it('exports a page as Markdown or HTML and a subtree as a zip', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    const space = await harness.space('EXP');
    const member = as(users.member);
    const elsewhere = await services.pages.create(member, { spaceId: space.id, title: 'Other' });
    const root = await services.pages.create(member, { spaceId: space.id, title: 'Runbook' });
    const first = await services.pages.create(member, {
      spaceId: space.id,
      parentId: root.id,
      title: 'Deploy',
    });
    const second = await services.pages.create(member, {
      spaceId: space.id,
      parentId: root.id,
      title: 'Deploy',
    });
    const deep = await services.pages.create(member, {
      spaceId: space.id,
      parentId: first.id,
      title: 'Rollback',
    });
    const gone = await services.pages.create(member, {
      spaceId: space.id,
      parentId: root.id,
      title: 'Old',
    });
    await services.pages.remove(member, gone.id);
    const link = (pageId: string) => ({ type: 'pageLink', attrs: { pageId, title: 'x' } });
    await services.pages.update(member, root.id, {
      snapshot: body(
        { type: 'heading', attrs: { level: 2 }, content: [text('Steps')] },
        para(text('See '), link(deep.id), text(' and '), link(elsewhere.id), text(' for '), {
          type: 'issueEmbed',
          attrs: { key: 'PLT-1' },
        }),
      ),
    });
    await services.pages.update(member, deep.id, {
      snapshot: body(para(text('Back to '), link(root.id))),
    });

    const md = await http.call('GET', `/pages/${root.id}/export`, { as: users.member });
    expect(md.statusCode).toBe(200);
    expect(md.headers['content-type']).toBe('text/markdown; charset=utf-8');
    expect(md.headers['content-disposition']).toContain('filename="runbook.md"');
    expect(md.body).toMatch(/^# Runbook\n\n## Steps/);
    expect(md.body).toContain(`(/docs/p/${deep.id})`);
    expect(md.body).toContain(`(/docs/p/${elsewhere.id})`);
    expect(md.body).toContain('/work/issue/PLT-1');

    const html = await http.call('GET', `/pages/${root.id}/export?format=html`, {
      as: users.viewer,
    });
    expect(html.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(html.body).toMatch(/^<!doctype html>/);
    expect(html.body).toContain('<style>');
    expect(html.body).toContain('<h1>Runbook</h1>');

    const zip = await http.call('GET', `/pages/${root.id}/export?scope=subtree`, {
      as: users.admin,
    });
    expect(zip.statusCode).toBe(200);
    expect(zip.headers['content-type']).toBe('application/zip');
    const files = readZip(zip.rawPayload);
    expect(Object.keys(files).sort()).toEqual([
      'runbook.md',
      'runbook/deploy-2.md',
      'runbook/deploy.md',
      'runbook/deploy/rollback.md',
    ]);
    expect(files['runbook/deploy/rollback.md']).toContain('(../../runbook.md)');
    expect(files['runbook.md']).toContain('(./runbook/deploy/rollback.md)');
    expect(second.id).toBeTruthy();

    const status = async (url: string, as: string) =>
      (await http.call('GET', url, { as })).statusCode;
    expect(await status(`/pages/${root.id}/export?scope=subtree`, users.member)).toBe(403);
    expect(await status(`/pages/${root.id}/export`, users.outsider)).toBe(403);
    expect(await status(`/pages/${root.id}/export?format=pdf`, users.member)).toBe(400);
    expect(await harness.auditActions()).toContain('page.exported');
  });

  it('imports Markdown folders and Confluence pages into a space', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users, sql } = harness;
    const space = await harness.space('IMP');
    const parent = await services.pages.create(as(users.member), {
      spaceId: space.id,
      title: 'Imported',
    });

    const markdown = await http.call('POST', `/spaces/IMP/imports`, {
      as: users.member,
      body: {
        format: 'markdown',
        parentId: parent.id,
        files: [
          { path: 'guides/README.md', content: '# Guides\n\nStart here.' },
          { path: 'guides/deploy.md', content: '---\ntitle: Deploying\n---\n- build\n- **ship**' },
        ],
      },
    });
    expect(markdown.statusCode).toBe(201);
    const pages = markdown.json<Extract<ImportResult, { status: 'completed' }>>().pages;
    expect(pages.map((page) => [page.title, page.parentId === parent.id])).toEqual([
      ['Guides', true],
      ['Deploying', false],
    ]);
    expect(pages[1]!.parentId).toBe(pages[0]!.id);
    const [deploy] = await sql<{ text: string; word_count: number }[]>`
      select text, word_count from pages where id = ${pages[1]!.id}`;
    expect(deploy).toEqual({ text: 'build\nship', word_count: 2 });

    const confluence = await http.call('POST', `/spaces/${space.id}/imports`, {
      as: users.member,
      body: {
        format: 'confluence',
        files: [
          { path: 'runbook.html', title: 'Runbook', content: '<p>Restart the worker.</p>' },
          {
            path: 'oncall.html',
            title: 'On-call',
            content:
              '<p>Read <ac:link><ri:page ri:content-title="Runbook"/></ac:link> first.</p>' +
              '<ac:structured-macro ac:name="jira-chart"><ac:parameter ac:name="jql">x</ac:parameter></ac:structured-macro>',
          },
        ],
      },
    });
    const imported = confluence.json<Extract<ImportResult, { status: 'completed' }>>().pages;
    expect(imported.map((page) => [page.title, page.placeholders])).toEqual([
      ['Runbook', 0],
      ['On-call', 1],
    ]);
    const edges = await sql`select target_id from links where source_id = ${imported[1]!.id}`;
    expect(edges).toEqual([{ target_id: imported[0]!.id }]);
    expect(harness.realtime.some((message) => message.kind === 'docs.tree')).toBe(true);
    expect(await harness.auditActions()).toContain('space.pages_imported');
  });

  it('queues a large import once per idempotency key and runs it as a job', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, users, sql } = harness;
    const space = await harness.space('BIG');
    const files = Array.from({ length: 30 }, (_, i) => ({
      path: `notes/n${i}.md`,
      content: `Note ${i}`,
    }));
    const send = () =>
      http.app.inject({
        method: 'POST',
        url: '/api/v1/docs/spaces/BIG/imports',
        headers: { 'x-test-user': users.member, 'idempotency-key': 'upload-1' },
        payload: { format: 'markdown', files },
      });
    const first = await send();
    expect(first.statusCode).toBe(202);
    expect(first.json()).toMatchObject({ status: 'queued', idempotencyKey: 'upload-1' });
    await send();
    const ours = queued.filter((job) => job.name === 'docs.import');
    expect(ours.map((job) => job.key)).toEqual([
      `docs.import:${space.id}:upload-1`,
      `docs.import:${space.id}:upload-1`,
    ]);
    await importJob(services.transfer).handle(ours[0]!.payload, {
      jobId: 'j1',
      signal: new AbortController().signal,
    });
    const [count] = await sql<{ n: number }[]>`
      select count(*)::int as n from pages where space_id = ${space.id} and deleted_at is null`;
    expect(count?.n).toBe(31);
    expect((ours[0]!.payload as { userId: string }).userId).toBe(users.member);
  });

  it('refuses imports the person may not make or that are malformed', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { services, as, users } = harness;
    await harness.space('REF');
    const other = await harness.space('OTR');
    const foreign = await services.pages.create(as(users.member), {
      spaceId: other.id,
      title: 'X',
    });
    const file = { path: 'a.md', content: 'A' };
    const post = async (as: string | null, payload: unknown) =>
      (await http.call('POST', '/spaces/REF/imports', { as, body: payload })).statusCode;
    expect(await post(null, { format: 'markdown', files: [file] })).toBe(401);
    expect(await post(users.viewer, { format: 'markdown', files: [file] })).toBe(403);
    expect(await post(users.outsider, { format: 'markdown', files: [file] })).toBe(403);
    expect(
      await post(users.member, { format: 'markdown', files: [{ path: 'a.pdf', content: '' }] }),
    ).toBe(400);
    expect(
      await post(users.member, { format: 'markdown', files: [{ path: '../a.md', content: '' }] }),
    ).toBe(400);
    expect(await post(users.member, { format: 'markdown', files: [] })).toBe(400);
    expect(
      await post(users.member, { format: 'markdown', parentId: foreign.id, files: [file] }),
    ).toBe(400);
  });
});
