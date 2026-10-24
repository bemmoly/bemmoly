import type { AiToolDefinition, AiToolRunContext, RequestContext } from '@bemmoly/core';
import { NotFoundError, type UploadedFile, type UploadFileQuery } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RichText } from '../../../../shared/common.ts';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';
import { docsAiTools } from './index.ts';

/*
 * An agent putting a file in a page over MCP: at the end of the page, or anywhere in its body
 * through Markdown, sent inline or to an upload link first. The kernel's files API stands in
 * as a small store; its own sniffing, limits, headers and links are tested in
 * apps/server/src/files.int.test.ts and apps/server/src/upload-links.int.test.ts.
 */

const stored = new Map<string, UploadedFile & { targetId: string }>();

const fakeFiles = {
  async upload(_ctx: RequestContext, query: UploadFileQuery, body: Buffer) {
    const id = `0199c0de-0000-7000-8000-${String(stored.size + 1).padStart(12, '0')}`;
    const mime = body.subarray(0, 5).toString() === '%PDF-' ? 'application/pdf' : 'text/html';
    const file = { id, url: `/api/v1/files/${id}`, name: query.name ?? 'file', mime, size: 1 };
    stored.set(id, { ...(file as UploadedFile), targetId: query.targetId });
    return file as UploadedFile;
  },
  async stat(_ctx: RequestContext, id: string) {
    const file = stored.get(id);
    if (!file) throw new NotFoundError('The file was not found');
    const target = { kind: 'docs.page', id: file.targetId };
    return { name: file.name, mime: file.mime, size: file.size, target };
  },
  async read(): Promise<never> {
    return Promise.reject(new NotFoundError('The file was not found'));
  },
};

let h: DocsHarness | undefined;
let skipped = '';
let tools: Map<string, AiToolDefinition>;

beforeAll(async () => {
  const started = await startDocsHarness({ files: fakeFiles as never });
  if (!started.available) {
    skipped = started.reason;
    return;
  }
  h = started.harness;
  await h.space('RPT');
  tools = new Map(docsAiTools(h.services).map((tool) => [tool.name, tool]));
});

afterAll(async () => {
  await h?.stop();
});

const runContext = (ctx: RequestContext): AiToolRunContext => ({
  ...ctx,
  planId: '00000000-0000-7000-8000-000000000000',
  stepIndex: 0,
  attribution: 'via Bemmoly',
  runId: null,
});

async function write(name: string, ctx: RequestContext, input: unknown) {
  const tool = tools.get(name);
  if (tool?.kind !== 'write') throw new Error(`${name} is not a write tool`);
  const parsed = tool.input.parse(input);
  await tool.authorize(ctx, parsed);
  const outcome = await tool.run(runContext(ctx), parsed);
  return {
    result: (outcome.result ?? {}) as Record<string, unknown>,
    undo: () => tool.undo?.(runContext(ctx), outcome.undo),
  };
}

const blocks = async (ctx: RequestContext, pageId: string) => {
  const page = await h!.services.pages.get(ctx, pageId);
  return ((page.snapshot as RichText & { content: { type: string; attrs?: object }[] }).content ??
    []) as { type: string; attrs?: Record<string, unknown> }[];
};

describe('docs_upload_file', () => {
  it('adds an HTML report at the end of a page, and undoes it', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const member = h.as(h.users.member);
    const page = await write('docs_create_page', member, {
      spaceKey: 'RPT',
      title: 'Weekly report',
      body: 'Numbers for the week.',
    });
    const pageId = String(page.result['id']);
    const added = await write('docs_upload_file', member, {
      pageId,
      name: 'weekly.html',
      content: '<!doctype html><h1>Week 42</h1>',
    });
    expect(added.result).toMatchObject({ mime: 'text/html', appended: true });
    expect(added.result['markdown']).toBe(`![weekly.html](${String(added.result['url'])})`);
    const after = await blocks(member, pageId);
    expect(after.map((block) => block.type)).toEqual(['paragraph', 'file']);
    expect(after[1]!.attrs).toEqual({
      src: added.result['url'],
      name: 'weekly.html',
      mime: 'text/html',
    });

    await added.undo();
    expect((await blocks(member, pageId)).map((block) => block.type)).toEqual(['paragraph']);
  });

  it('places a PDF between paragraphs through Markdown; unknown files stay images', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const member = h.as(h.users.member);
    const page = await write('docs_create_page', member, { spaceKey: 'RPT', title: 'Spec' });
    const pageId = String(page.result['id']);
    const pdf = await write('docs_upload_file', member, {
      pageId,
      name: 'spec.pdf',
      content: Buffer.from('%PDF-1.7\n').toString('base64'),
      encoding: 'base64',
      append: false,
    });
    expect(pdf.result).toMatchObject({ mime: 'application/pdf', appended: false });
    const missing = '/api/v1/files/0199c0de-0000-7000-8000-00000000ffff';
    await write('docs_update_page', member, {
      pageId,
      body: `Before.\n\n${String(pdf.result['markdown'])}\n\nAfter.\n\n![Gone](${missing})\n`,
    });
    const types = (await blocks(member, pageId)).map((block) => [block.type, block.attrs?.['src']]);
    expect(types).toEqual([
      ['paragraph', undefined],
      ['file', pdf.result['url']],
      ['paragraph', undefined],
      ['image', missing],
    ]);
  });

  it('makes a page that is one stored HTML file, for New page > Upload', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const member = h.as(h.users.member);
    const page = await write('docs_create_page', member, { spaceKey: 'RPT', title: 'Q3 report' });
    const pageId = String(page.result['id']);
    const stored = await fakeFiles.upload(
      member,
      { target: 'docs.page', targetId: pageId, name: 'q3.html' },
      Buffer.from('<!doctype html>'),
    );
    const detail = await h.services.attachments.attach(member, pageId, stored.id);
    expect(detail.id).toBe(pageId);
    const types = (await blocks(member, pageId)).map((block) => [block.type, block.attrs?.['src']]);
    expect(types.at(-1)).toEqual(['file', stored.url]);
    await expect(
      h.services.attachments.attach(h.as(h.users.viewer), pageId, stored.id),
    ).rejects.toThrow();
    await expect(
      h.services.attachments.attach(member, pageId, '0199c0de-0000-7000-8000-00000000eeee'),
    ).rejects.toThrow('The file was not found');
  });

  it('replaces the one file of a file page rather than adding a second', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const member = h.as(h.users.member);
    const space = await h.space('FIL');
    const page = await h.services.pages.create(member, {
      spaceId: space.id,
      title: 'Q4 report',
      kind: 'file',
    });
    const upload = (name: string) =>
      fakeFiles.upload(
        member,
        { target: 'docs.page', targetId: page.id, name },
        Buffer.from('<!doctype html>'),
      );
    const first = await upload('q4.html');
    await h.services.attachments.attach(member, page.id, first.id);
    const second = await upload('q4-final.html');
    const detail = await h.services.attachments.attach(member, page.id, second.id);
    expect(detail.kind).toBe('file');
    const files = (await blocks(member, page.id)).filter((block) => block.type === 'file');
    expect(files.map((block) => block.attrs?.['src'])).toEqual([second.url]);
  });

  it('refuses people who may only read the page', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const page = await write('docs_create_page', h.as(h.users.member), {
      spaceKey: 'RPT',
      title: 'Read only',
    });
    await expect(
      write('docs_upload_file', h.as(h.users.viewer), {
        pageId: page.result['id'],
        name: 'x.html',
        content: '<!doctype html>',
      }),
    ).rejects.toThrow();
  });

  it('adds a file sent to an upload link by its id, only on its own page', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const member = h.as(h.users.member);
    const create = (title: string) =>
      write('docs_create_page', member, { spaceKey: 'RPT', title, body: 'Intro.' });
    const pageId = String((await create('Large report')).result['id']);
    const other = String((await create('Elsewhere')).result['id']);
    // What PUT /api/v1/upload-links/:token stores, as the person, against the page.
    const sent = await fakeFiles.upload(
      member,
      { target: 'docs.page', targetId: pageId, name: 'large.pdf' },
      Buffer.from('%PDF-1.7\n'),
    );
    const added = await write('docs_upload_file', member, { pageId, fileId: sent.id });
    expect(added.result).toMatchObject({ id: sent.id, mime: 'application/pdf', appended: true });
    expect((await blocks(member, pageId)).at(-1)).toEqual({
      type: 'file',
      attrs: { src: sent.url, name: 'large.pdf', mime: 'application/pdf' },
    });
    await added.undo();
    expect((await blocks(member, pageId)).map((block) => block.type)).toEqual(['paragraph']);

    await expect(
      write('docs_upload_file', member, { pageId: other, fileId: sent.id }),
    ).rejects.toThrow(/another page/);
  });

  it('takes content or a fileId, never both or neither', () => {
    if (!h) return;
    const input = tools.get('docs_upload_file')!.input;
    const pageId = '0199c0de-0000-7000-8000-000000000001';
    const fileId = '0199c0de-0000-7000-8000-000000000002';
    expect(input.safeParse({ pageId }).success).toBe(false);
    expect(input.safeParse({ pageId, fileId, name: 'a.pdf', content: 'x' }).success).toBe(false);
    expect(input.safeParse({ pageId, content: 'x' }).success).toBe(false);
    expect(input.safeParse({ pageId, fileId }).success).toBe(true);
  });
});
