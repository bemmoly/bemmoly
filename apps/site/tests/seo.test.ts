/**
 * Search checks on the built site (run `pnpm build` first): one page entry per built page,
 * titles and descriptions in the lengths search results show, a sound heading outline,
 * images with text and sizes, valid JSON-LD that only states what the page states, and no
 * other product's name outside the import-source labels the owner allows.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PAGES, type SitePage } from '../src/data/pages.ts';
import { LATEST } from '../src/lib/changelog.ts';
import { parsePage, scriptsOf } from './dom.ts';

const dist = new URL('../dist/', import.meta.url);
const files = readdirSync(dist, { recursive: true, encoding: 'utf8' });
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const fileOf = (path: string) => (path === '/' ? 'index.html' : `${path.slice(1)}.html`);
const read = (file: string) => readFileSync(new URL(file, dist), 'utf8');

const meta = (source: string, attribute: 'name' | 'property', key: string) =>
  new RegExp(`<meta ${attribute}="${key}" content="([^"]*)"`).exec(source)?.[1];
const decode = (text: string) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

interface Node {
  '@type': string;
  '@id'?: string;
  [key: string]: unknown;
}

function graphOf(source: string): Node[] {
  const blocks = scriptsOf(parsePage(source)).filter(
    (script) => script.type === 'application/ld+json',
  );
  expect(blocks).toHaveLength(1);
  const data = JSON.parse(blocks[0]?.body ?? '') as { '@context': string; '@graph': Node[] };
  expect(data['@context']).toBe('https://schema.org');
  return data['@graph'];
}

/** Every {"@id": …} reference anywhere in the graph. */
function references(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(references);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 1 && entries[0]?.[0] === '@id') return [String(entries[0][1])];
    return entries.flatMap(([, child]) => references(child));
  }
  return [];
}

const visibleText = (source: string) =>
  decode(
    source
      .replace(/<script[\s\S]*?<\/script>/g, ' ')
      .replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ');

describe('pages', () => {
  it('has one page entry for every built page, and a built page for every entry', () => {
    const built = htmlFiles.filter((file) => file !== '404.html').sort();
    expect(PAGES.map((page) => fileOf(page.path)).sort()).toEqual(built);
  });

  it.each(PAGES)('$path has a title and description search results can show', (page) => {
    const source = read(fileOf(page.path));
    expect(source).toContain(`<title>${page.title.replace(/&/g, '&amp;')}</title>`);
    expect(page.title.length, page.title).toBeGreaterThanOrEqual(30);
    expect(page.title.length, page.title).toBeLessThanOrEqual(60);
    expect(page.description.length, page.description).toBeGreaterThanOrEqual(70);
    expect(page.description.length, page.description).toBeLessThanOrEqual(160);
    expect(decode(meta(source, 'name', 'description') ?? '')).toBe(page.description);
  });

  it('gives every page its own title and description', () => {
    expect(new Set(PAGES.map((page) => page.title)).size).toBe(PAGES.length);
    expect(new Set(PAGES.map((page) => page.description)).size).toBe(PAGES.length);
  });

  it.each(PAGES)('$path names its one address everywhere', (page) => {
    const source = read(fileOf(page.path));
    const canonical = new URL(page.path, 'https://bemmoly.com').href;
    expect(source).toContain(`<link rel="canonical" href="${canonical}">`);
    expect(meta(source, 'property', 'og:url')).toBe(canonical);
    expect(meta(source, 'property', 'og:image')).toMatch(/^https:\/\/bemmoly\.com\/_astro\//);
    expect(meta(source, 'name', 'twitter:card')).toBe('summary_large_image');
  });

  it.each(htmlFiles)('%s has one h1 and never skips a heading level', (file) => {
    const levels = [...read(file).matchAll(/<h([1-6])\b/g)].map((match) => Number(match[1]));
    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    levels.reduce((previous, level) => {
      expect(level - previous, `${file}: h${previous} then h${level}`).toBeLessThanOrEqual(1);
      return level;
    });
  });

  it.each(htmlFiles)('%s gives every image text and a size', (file) => {
    for (const image of parsePage(read(file)).querySelectorAll('img')) {
      for (const attribute of ['alt', 'width', 'height']) {
        expect(image.hasAttribute(attribute), `${file} img ${attribute}`).toBe(true);
      }
      expect(String(image.getAttribute('alt')?.value ?? '').length).toBeGreaterThan(0);
    }
  });

  it('leaves the verification tags out unless their tokens are set', () => {
    for (const file of htmlFiles) {
      expect(read(file)).not.toMatch(/google-site-verification|msvalidate\.01/);
    }
  });
});

describe('structured data', () => {
  const graphs = PAGES.map((page: SitePage) => ({
    page,
    graph: graphOf(read(fileOf(page.path))),
  }));

  it.each(graphs)('$page.path resolves every reference inside its graph', ({ graph }) => {
    const ids = new Set(graph.flatMap((node) => node['@id'] ?? []));
    for (const id of references(graph)) expect(ids, id).toContain(id);
    for (const type of ['Organization', 'WebSite', 'WebPage']) {
      expect(graph.map((node) => node['@type'])).toContain(type);
    }
  });

  it('describes the software only with true, checkable facts', () => {
    const softwarePages = graphs.filter(({ page }) => page.software);
    expect(softwarePages.length).toBeGreaterThan(0);
    for (const { page, graph } of graphs) {
      const app = graph.find((node) => node['@type'] === 'SoftwareApplication');
      expect(Boolean(app), page.path).toBe(Boolean(page.software));
      if (!app) continue;
      expect(app).toMatchObject({
        name: 'Bemmoly',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Linux',
        softwareVersion: LATEST.version,
        license: 'https://opensource.org/licenses/MIT',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      });
    }
    const all = JSON.stringify(graphs.map(({ graph }) => graph));
    for (const invented of ['aggregateRating', 'review', 'ratingValue', 'interactionStatistic']) {
      expect(all).not.toContain(invented);
    }
  });

  it.each(graphs.filter(({ page }) => page.path !== '/'))(
    '$page.path has breadcrumbs that end at the page',
    ({ page, graph }: { page: SitePage; graph: Node[] }) => {
      const trail = graph.find((node) => node['@type'] === 'BreadcrumbList');
      const items = (trail?.itemListElement ?? []) as { position: number; item: string }[];
      expect(items.map((item) => item.position)).toEqual(items.map((_, index) => index + 1));
      expect(items[0]?.item).toBe('https://bemmoly.com/');
      expect(items.at(-1)?.item).toBe(new URL(page.path, 'https://bemmoly.com').href);
    },
  );

  it('only answers questions the page answers in its own words', () => {
    const faqs = graphs.filter(({ graph }) => graph.some((node) => node['@type'] === 'FAQPage'));
    expect(faqs.length).toBeGreaterThan(0);
    for (const { page, graph } of faqs) {
      const text = visibleText(read(fileOf(page.path)));
      const faq = graph.find((node) => node['@type'] === 'FAQPage');
      for (const question of faq?.mainEntity as {
        name: string;
        acceptedAnswer: { text: string };
      }[]) {
        expect(text).toContain(question.name);
        expect(text).toContain(question.acceptedAnswer.text);
      }
    }
  });
});

/**
 * The owner's trademark rule: other products are named only as import sources ("Import from
 * Jira"). The allowed phrases are listed; anything else fails.
 */
describe('other products', () => {
  const NAMES =
    /\b(Jira|Confluence|Atlassian|Linear|Asana|Trello|Notion|ClickUp|monday\.com|Basecamp|Wrike|Smartsheet|YouTrack|Redmine|OpenProject)\b/g;
  const ALLOWED = [
    /Imports? from Jira and Confluence/g,
    /Import from Jira/g,
    /Import from Confluence/g,
    /the Jira and Confluence marks/g,
  ];
  const textFiles = files.filter((file) => /\.(html|xml|txt|webmanifest|json)$/.test(file));

  it.each(textFiles)('%s names no other product outside an import label', (file) => {
    let text = decode(read(file));
    for (const allowed of ALLOWED) text = text.replace(allowed, '');
    expect(text.match(NAMES) ?? []).toEqual([]);
  });

  it('keeps names out of every address', () => {
    const urls = PAGES.map((page) => page.path).join(' ');
    expect(urls.match(new RegExp(NAMES.source, 'gi')) ?? []).toEqual([]);
  });
});
