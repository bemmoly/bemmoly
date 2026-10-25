import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness } from './boot-harness.ts';

/*
 * A link shared in a chat app is fetched signed out: the shell names the page or issue it
 * opens, under the workspace's name, until an admin turns previews off or the module is
 * disabled.
 */

const SHELL = `<!doctype html><html><head>
<meta name="description" content="Bemmoly: your work. Your platform." />
<title>Bemmoly</title>
</head><body><div id="root"></div></body></html>`;

describe('link previews', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';

  beforeAll(async () => {
    const webRoot = mkdtempSync(join(tmpdir(), 'bemmoly-web-'));
    writeFileSync(join(webRoot, 'index.html'), SHELL);
    const started = await startBootHarness({ webRoot });
    if (started.available) harness = started.harness;
    else skipReason = started.reason;
  });

  afterAll(async () => harness?.stop());

  it('names shared pages and issues to a signed-out crawler', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const app = await harness.boot();
    const call = async (method: string, url: string, payload?: unknown) => {
      const response = await app.inject({
        method: method as 'GET',
        url: `/api/v1${url}`,
        ...(payload !== undefined ? { payload: payload as object } : {}),
      });
      if (response.statusCode >= 400) throw new Error(`${method} ${url}: ${response.body}`);
      return response.statusCode === 204 ? null : response.json();
    };
    for (const id of ['work', 'docs']) {
      await call('POST', `/admin/modules/${id}/enable`, { access: { mode: 'everyone' } });
    }
    const project = await call('POST', '/work/projects', { key: 'PLT', name: 'Platform' });
    const types = (await call('GET', '/work/projects/PLT/issue-types')).items as {
      id: string;
      key: string;
    }[];
    await call('POST', '/work/issues', {
      projectId: project.id,
      typeId: types.find((type) => type.key === 'task')!.id,
      title: 'Warm the cache',
    });
    const space = await call('POST', '/docs/spaces', { key: 'ENG', name: 'Engineering' });
    const page = await call('POST', '/docs/pages', { spaceId: space.id, title: 'Cache plan' });

    const crawl = async (url: string) => (await app.instance.app.inject({ url })).body;
    const ogTitle = (html: string) => /property="og:title" content="([^"]*)"/.exec(html)?.[1];

    const issueHtml = await crawl('/work/issue/PLT-1');
    expect(ogTitle(issueHtml)).toBe('PLT-1 Warm the cache');
    expect(issueHtml).toContain('<meta property="og:site_name" content="Acme Labs" />');
    expect(issueHtml).toContain('<meta name="description" content="Issue in Acme Labs" />');
    expect(ogTitle(await crawl(`/docs/p/${page.id}/history`))).toBe('Cache plan');
    expect(ogTitle(await crawl('/work/issue/PLT-99'))).toBeUndefined();
    expect(ogTitle(await crawl('/docs/p/not-a-page'))).toBeUndefined();

    await call('PUT', '/admin/settings/workspace.linkPreviews', { value: false });
    expect(await crawl('/work/issue/PLT-1')).toContain('<title>Bemmoly</title>');
    await call('PUT', '/admin/settings/workspace.linkPreviews', { value: true });

    await call('POST', '/admin/modules/work/disable');
    expect(ogTitle(await crawl('/work/issue/PLT-1'))).toBeUndefined();
    expect(ogTitle(await crawl(`/docs/p/${page.id}`))).toBe('Cache plan');
  });
});
