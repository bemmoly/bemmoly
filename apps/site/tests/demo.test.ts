/**
 * The live demo in the built site (scripts/bundle-demo.ts): apps/web's demo build at
 * dist/demo, its page titled from DEMO_PAGE, its files under /demo, and the Caddyfile's
 * rules for it. The click-through itself runs in a browser (README: Live demo).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { demoWorkspace } from '../../web/src/demo/workspace.ts';
import { createMockApi } from '../../web/src/mocks/dispatch.ts';
import { DEMO_PAGE } from '../src/data/pages.ts';
import { PREVIEWS } from '../src/data/previews.ts';
import { parsePage, scriptsOf } from './dom.ts';

const dist = new URL('../dist/', import.meta.url);
const read = (file: string) => readFileSync(new URL(file, dist), 'utf8');
const page = read('demo/index.html');
const meta = (source: string, attribute: 'name' | 'property', key: string) =>
  new RegExp(`<meta ${attribute}="${key}" content="([^"]*)"`).exec(source)?.[1];

describe('live demo', () => {
  it('is bundled at /demo with its scripts and styles under the same path', () => {
    const scripts = scriptsOf(parsePage(page)).flatMap((script) => script.src ?? []);
    expect(scripts.length).toBeGreaterThan(0);
    const files = [...scripts, ...[...page.matchAll(/href="([^"]+)"/g)].map((m) => m[1] ?? '')]
      .filter((url) => url.startsWith('/'))
      .map((url) => url.slice(1));
    for (const file of files) {
      expect(file.startsWith('demo/'), file).toBe(true);
      expect(existsSync(new URL(file, dist)), file).toBe(true);
    }
  });

  it('is titled and described from the same list as the pages, with the home share card', () => {
    expect(page).toContain(`<title>${DEMO_PAGE.title}</title>`);
    expect(meta(page, 'name', 'description')).toBe(DEMO_PAGE.description);
    expect(page).toContain('<link rel="canonical" href="https://bemmoly.com/demo"');
    expect(meta(page, 'property', 'og:image')).toBe(
      meta(read('index.html'), 'property', 'og:image'),
    );
    expect(page).not.toContain('rel="manifest"');
  });

  it('runs no inline script, so its own content security policy needs no hash', () => {
    const inline = scriptsOf(parsePage(page)).filter((script) => script.src === undefined);
    expect(inline).toEqual([]);
  });

  it('carries no stale precompressed page and none of the brand banners', () => {
    expect(existsSync(new URL('demo/index.html.br', dist))).toBe(false);
    expect(readdirSync(new URL('demo/brand/', dist)).filter((f) => f.endsWith('.png'))).toEqual(
      expect.not.arrayContaining([expect.stringMatching(/^banner-/)]),
    );
  });

  it.each(PREVIEWS)('the $id preview opens a route the demo has sample data for', (preview) => {
    // The demo's own workspace and mock backend (apps/web), asked what the screen would ask.
    const api = createMockApi(demoWorkspace());
    const [, , , screen, key, id] = preview.path.split('/');
    const asks: Record<string, string> = {
      board: `/api/v1/work/projects/${key}/sprints`,
      issue: `/api/v1/work/issues/${key}`,
      workflows: `/api/v1/work/workflows/${id}`,
    };
    const ask = asks[screen ?? ''];
    expect(ask, preview.path).toBeDefined();
    expect(api.dispatch('GET', ask ?? '', undefined)?.status, preview.path).toBe(200);
  });

  it('is served as one page for every route, framed only by the site, indexed only at /demo', () => {
    const caddy = readFileSync(new URL('../Caddyfile', import.meta.url), 'utf8');
    const block = /handle @demo \{([\s\S]*?)\n\t\}/.exec(caddy)?.[1] ?? '';
    expect(block).toContain('rewrite @route /demo/index.html');
    expect(block).toContain('X-Frame-Options "SAMEORIGIN"');
    expect(block).toContain("frame-ancestors 'self'");
    expect(block).toContain('@deep path /demo/*');
    expect(block).toContain('header @deep X-Robots-Tag "noindex"');
  });
});
