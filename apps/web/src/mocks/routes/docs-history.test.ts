import { describe, expect, it } from 'vitest';
import { createMockApi } from '../dispatch.ts';
import { uid } from '../seed/time.ts';

/* The doc editor's side panel runs on these: history, comments, links, export and import. */

const RFC = uid(5101);
const BASE = `/api/v1/docs/pages/${RFC}`;

interface Listed<T> {
  items: T[];
}
type Body = Record<string, unknown>;

const call = (api: ReturnType<typeof createMockApi>, method: string, url: string, body?: unknown) =>
  api.dispatch(method, url, body)!;

describe('version history on the mock backend', () => {
  it('lists the RFC versions newest first and compares one with the page now', () => {
    const api = createMockApi('ready');
    const list = call(api, 'GET', `${BASE}/revisions`).body as Listed<Body>;
    expect(list.items.map((rev) => rev['number'])).toEqual([3, 2, 1]);
    const compare = call(
      api,
      'GET',
      `${BASE}/revisions/compare?from=${String(list.items[2]!['id'])}&to=current`,
    ).body as { diff: { blocks: { op: string }[]; stats: Record<string, number> } };
    const ops = new Set(compare.diff.blocks.map((block) => block.op));
    expect(ops).toContain('insert');
    expect(ops).toContain('change');
    expect(compare.diff.stats['inserted']).toBeGreaterThan(0);
  });

  it('saves a named version and restores an older one as a new version', () => {
    const api = createMockApi('ready');
    const saved = call(api, 'POST', `${BASE}/revisions`, { label: 'Ready for review' });
    expect(saved).toMatchObject({
      status: 201,
      body: { number: 4, kind: 'named', label: 'Ready for review' },
    });
    const oldest = (call(api, 'GET', `${BASE}/revisions`).body as Listed<Body>).items.at(-1)!;
    const restored = call(api, 'POST', `${BASE}/revisions/${String(oldest['id'])}/restore`);
    expect(restored.body).toMatchObject({ number: 5, kind: 'restore' });
    const page = call(api, 'GET', BASE).body as { snapshot: unknown };
    expect(JSON.stringify(page.snapshot)).toContain('30 minutes');
  });
});

describe('comments on the mock backend', () => {
  it('lists open threads with anchor states and a resolved one apart', () => {
    const api = createMockApi('ready');
    const open = (call(api, 'GET', `${BASE}/comments?resolved=false`).body as Listed<Body>).items;
    expect(open.filter((item) => !item['parentId'])).toHaveLength(4);
    expect(open.map((item) => item['anchorStatus'])).toContain('text_changed');
    const resolved = (call(api, 'GET', `${BASE}/comments?resolved=true`).body as Listed<Body>)
      .items;
    expect(resolved.map((item) => item['bodyText'])).toEqual([
      'Done on staging, backfill verified.',
    ]);
  });

  it('creates, resolves and applies a fix once, then says it is stale', () => {
    const api = createMockApi('ready');
    const body = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }],
    };
    const made = call(api, 'POST', `${BASE}/comments`, { body });
    expect(made).toMatchObject({
      status: 201,
      body: { bodyText: 'Hi', author: { name: expect.any(String) } },
    });
    const id = String((made.body as Body)['id']);
    expect(call(api, 'POST', `/api/v1/docs/comments/${id}/resolve`).body).toMatchObject({
      resolvedAt: expect.any(String),
    });
    const fix = uid(9401);
    expect(call(api, 'POST', `/api/v1/docs/comments/${fix}/apply-suggestion`).status).toBe(200);
    expect(JSON.stringify((call(api, 'GET', BASE).body as Body)['snapshot'])).toContain(
      'stay valid for 30 minutes',
    );
    call(api, 'POST', `/api/v1/docs/comments/${fix}/reopen`);
    expect(call(api, 'POST', `/api/v1/docs/comments/${fix}/apply-suggestion`).status).toBe(409);
  });
});

describe('links, export and import on the mock backend', () => {
  it('reads issues referenced from the body and the pages that point back', () => {
    const api = createMockApi('ready');
    const links = (call(api, 'GET', `${BASE}/links`).body as Listed<{ record: Body }>).items;
    expect(links.map((link) => link.record['key'])).toEqual(['PLT-204', 'PLT-218', 'PLT-222']);
    expect((call(api, 'GET', `${BASE}/references`).body as Listed<Body>).items).toHaveLength(2);
    expect(
      (call(api, 'GET', `${BASE}/backlinks`).body as Listed<Body>).items.length,
    ).toBeGreaterThan(0);
  });

  it('exports Markdown as a file to download', () => {
    const api = createMockApi('ready');
    const file = call(api, 'GET', `${BASE}/export?format=markdown&scope=page`);
    expect(file.headers?.['content-disposition']).toMatch(/attachment; filename=".+\.md"/);
    expect(file.body).toContain('## Rollback');
  });

  it('imports Markdown files with folders as parent pages', () => {
    const api = createMockApi('ready');
    const result = call(api, 'POST', '/api/v1/docs/spaces/ENG/imports', {
      format: 'markdown',
      files: [
        { path: 'guides/setup.md', content: '---\ntitle: Set up\n---\nInstall it.' },
        { path: 'intro.md', content: '# Welcome\n\nHello.' },
      ],
    });
    const pages = (result.body as { pages: Body[] }).pages;
    expect(result.status).toBe(201);
    expect(pages.map((row) => row['title'])).toEqual(['guides', 'Set up', 'Welcome']);
    expect(pages[1]!['parentId']).toBe(pages[0]!['id']);
  });
});
