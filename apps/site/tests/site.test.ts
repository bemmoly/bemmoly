/**
 * Checks the built site (run `pnpm build` first; turbo does it for `test`): the landing page
 * renders its headline, every link on every page resolves, and the static files are there.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO_URL } from '../src/lib/links.ts';
import { hrefsOf, idsOf, parsePage, scriptsOf } from './dom.ts';
import { startPreview, type Preview } from './serve.ts';

const dist = new URL('../dist/', import.meta.url);
const pages = readdirSync(dist).filter((file) => file.endsWith('.html'));
const html = (page: string) => readFileSync(new URL(page, dist), 'utf8');

const hrefs = (source: string) => hrefsOf(parsePage(source));
const ids = (source: string) => idsOf(parsePage(source));

let preview: Preview;
beforeAll(async () => {
  preview = await startPreview();
});
afterAll(() => preview?.stop());

describe('landing page', () => {
  it('renders the hero headline', async () => {
    const body = await (await fetch(`${preview.url}/`)).text();
    expect(body).toMatch(/<h1\b[^>]*>\s*Your work\. Your platform\.\s*<\/h1>/);
  });

  it('shows the installer one-liner and the Postgres 18 transcript', () => {
    const index = html('index.html');
    expect(index).toContain('curl -fsSL https://get.bemmoly.com | sh');
    expect(index).toContain('Installing Postgres 18');
    expect(index).not.toContain('bemmoly.dev');
  });

  it('is light for every visitor, with Ocean only behind data-theme="dark"', () => {
    const index = html('index.html');
    expect(index).not.toContain('prefers-color-scheme');
    expect(index).toContain('<meta name="color-scheme" content="light">');
    expect(index).toMatch(/html\[data-theme=['"]?dark['"]?\][^{]*\{[^}]*--bg:#07111c/);
  });

  it('ships no script beyond the inline copy button', () => {
    const scripts = scriptsOf(parsePage(html('index.html')));
    expect(scripts.filter((script) => script.src !== undefined)).toEqual([]);
    expect(scripts.reduce((total, script) => total + script.body.length, 0)).toBeLessThan(1024);
  });
});

describe('links', () => {
  const links = [...new Set(pages.flatMap((page) => hrefs(html(page))))];

  it('finds the navigation on every page', () => {
    for (const page of pages) {
      for (const href of ['/#product', '/self-hosting', '/docs', '/community', REPO_URL]) {
        expect(hrefs(html(page)), `${page} links to ${href}`).toContain(href);
      }
    }
  });

  it.each(links.filter((href) => href.startsWith('/')))('%s resolves', async (href) => {
    const [path, hash] = href.split('#') as [string, string | undefined];
    const response = await fetch(`${preview.url}${path || '/'}`);
    expect(response.status).toBe(200);
    if (hash) expect(ids(await response.text())).toContain(hash);
  });

  it('points outside the site only at the repository or a mail address', () => {
    const external = links.filter((href) => !href.startsWith('/'));
    for (const href of external) {
      expect(href.startsWith(REPO_URL) || href.startsWith('mailto:'), href).toBe(true);
    }
  });
});

describe('static files', () => {
  it.each(['/install.sh', '/robots.txt', '/sitemap-index.xml', '/site.webmanifest'])(
    '%s is served',
    async (path) => {
      expect((await fetch(`${preview.url}${path}`)).status).toBe(200);
    },
  );

  it('serves the installer from deploy/, byte for byte', () => {
    const script = readFileSync(new URL('install.sh', dist), 'utf8');
    const installer = readFileSync(new URL('../../../deploy/install.sh', import.meta.url), 'utf8');
    expect(script.startsWith('#!/bin/sh\n')).toBe(true);
    expect(script).toBe(installer);
  });

  it('declares the icons and social preview from the brand folder', () => {
    const index = html('index.html');
    expect(index).toMatch(/rel="icon" href="\/_astro\/favicon\.[\w-]+\.svg"/);
    expect(index).toMatch(/rel="apple-touch-icon" href="\/_astro\/apple-touch-icon\.[\w-]+\.png"/);
    expect(index).toMatch(
      /property="og:image" content="https:\/\/bemmoly\.com\/_astro\/social-preview\.[\w-]+\.png"/,
    );
    expect(index).toContain('<link rel="canonical" href="https://bemmoly.com/">');
  });
});
