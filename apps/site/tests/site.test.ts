/**
 * Checks the built site (run `pnpm build` first; turbo does it for `test`): the landing page
 * renders its headline, every link on every page resolves, and the static files are there.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CRAWLERS } from '../src/data/crawlers.ts';
import { PAGES } from '../src/data/pages.ts';
import { INDEXNOW_KEY } from '../src/lib/indexnow.ts';
import { REPO_URL } from '../src/lib/links.ts';
import { startPreview, type Preview } from './serve.ts';

const dist = new URL('../dist/', import.meta.url);
const pages = readdirSync(dist).filter((file) => file.endsWith('.html'));
const html = (page: string) => readFileSync(new URL(page, dist), 'utf8');

const hrefs = (source: string) =>
  [...source.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((match) => match[1] as string);
const ids = (source: string) =>
  new Set([...source.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1] as string));

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
    const index = html('index.html');
    expect(index).not.toMatch(/<script\b[^>]*\bsrc=/);
    const inline = [...index.matchAll(/<script\b(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)];
    expect(inline.map((match) => match[1]?.length ?? 0).reduce((a, b) => a + b, 0)).toBeLessThan(
      1024,
    );
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
  it.each([
    '/install.sh',
    '/robots.txt',
    '/sitemap-index.xml',
    '/site.webmanifest',
    '/llms.txt',
    `/${INDEXNOW_KEY}.txt`,
  ])('%s is served', async (path) => {
    expect((await fetch(`${preview.url}${path}`)).status).toBe(200);
  });

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

describe('indexing', () => {
  it('invites every search engine and AI crawler, and points at the sitemap', () => {
    const robots = readFileSync(new URL('robots.txt', dist), 'utf8');
    expect(robots).toContain('User-agent: *\nAllow: /');
    for (const { agents } of CRAWLERS) {
      for (const agent of agents) expect(robots).toContain(`User-agent: ${agent}`);
    }
    expect(robots).not.toContain('Disallow');
    expect(robots).toContain('Sitemap: https://bemmoly.com/sitemap-index.xml');
  });

  it('lists every page in the sitemap, with a date, and leaves the 404 page out', () => {
    const sitemap = readFileSync(new URL('sitemap-0.xml', dist), 'utf8');
    for (const { path } of PAGES)
      expect(sitemap).toContain(`<loc>https://bemmoly.com${path}</loc>`);
    expect(sitemap).toContain('<lastmod>');
    expect(sitemap).not.toContain('/404');
  });

  it('serves llms.txt in the llmstxt.org shape with every page', () => {
    const llms = readFileSync(new URL('llms.txt', dist), 'utf8');
    expect(llms.startsWith('# Bemmoly\n\n> ')).toBe(true);
    for (const { path, title } of PAGES) {
      expect(llms).toContain(`- [${title}](https://bemmoly.com${path})`);
    }
  });

  it('serves the IndexNow key at the path the protocol expects', () => {
    expect(readFileSync(new URL(`${INDEXNOW_KEY}.txt`, dist), 'utf8')).toBe(INDEXNOW_KEY);
  });

  it('marks pages indexable, the 404 page not, and carries structured data', () => {
    for (const page of pages) {
      const source = html(page);
      const expected = page === '404.html' ? 'noindex, follow' : 'index, follow';
      expect(source, page).toContain(`<meta name="robots" content="${expected}`);
      expect(source, page).toContain('<script type="application/ld+json">');
      expect(source, page).toContain('"@type":"SoftwareApplication"');
    }
  });
});
