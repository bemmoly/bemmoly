import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { withLinkPreview } from './middlewares/link-preview-html.ts';
import { shippedModules, TEST_ENV } from './test-support.ts';

const SHELL = `<!doctype html>
<html lang="en">
  <head>
    <meta name="description" content="Bemmoly: your work. Your platform." />
    <title>Bemmoly</title>
  </head>
  <body><div id="root"></div></body>
</html>`;

const PREVIEW = {
  title: 'PLT-204 Fix login',
  description: 'Issue in Acme Labs',
  siteName: 'Acme Labs',
};

function webRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'bemmoly-preview-'));
  writeFileSync(join(root, 'index.html'), SHELL);
  return root;
}

describe('withLinkPreview', () => {
  it('replaces the title and description and adds Open Graph tags', () => {
    const html = withLinkPreview(SHELL, PREVIEW);
    expect(html).toContain('<title>PLT-204 Fix login</title>');
    expect(html).toContain('<meta name="description" content="Issue in Acme Labs" />');
    expect(html).toContain('<meta property="og:title" content="PLT-204 Fix login" />');
    expect(html).toContain('<meta property="og:site_name" content="Acme Labs" />');
    expect(html).not.toContain('Your platform');
  });

  it('escapes what people typed', () => {
    const html = withLinkPreview(SHELL, { ...PREVIEW, title: '"><script>x</script> & $&' });
    expect(html).not.toContain('<script>x');
    expect(html).toContain('&quot;&gt;&lt;script&gt;x&lt;/script&gt; &amp; $&amp;');
  });
});

describe('the shell for a shared link', () => {
  async function appWith(linkPreview: (path: string) => Promise<typeof PREVIEW | null>) {
    return buildApp({
      env: TEST_ENV,
      modules: await shippedModules(),
      webRoot: webRoot(),
      linkPreview,
      logger: false,
    });
  }

  it('names the record the path opens', async () => {
    const app = await appWith(async (path) => (path === '/work/issue/PLT-204' ? PREVIEW : null));
    const shared = await app.inject({ url: '/work/issue/PLT-204?focus=comments' });
    expect(shared.statusCode).toBe(200);
    expect(shared.headers['content-type']).toContain('text/html');
    expect(shared.headers['cache-control']).toBe('no-cache');
    expect(shared.body).toContain('<meta property="og:title" content="PLT-204 Fix login" />');
    const other = await app.inject({ url: '/work/board' });
    expect(other.body).toContain('<title>Bemmoly</title>');
  });

  it('serves the plain shell when the lookup fails', async () => {
    const app = await appWith(async () => {
      throw new Error('database down');
    });
    const shared = await app.inject({ url: '/docs/p/0199c0de-0000-7000-8000-000000000001' });
    expect(shared.statusCode).toBe(200);
    expect(shared.body).toContain('<title>Bemmoly</title>');
  });
});
