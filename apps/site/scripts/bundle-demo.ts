/**
 * Puts the live demo into the site: copies apps/web's demo build (`pnpm --filter @bemmoly/web
 * build:demo`, which Turborepo runs before this build) to dist/demo, where the Caddyfile serves
 * it at /demo, and gives its page the title, description and share card from DEMO_PAGE in
 * src/data/pages.ts. The build fails without the demo, so a deploy never ships a dead link.
 */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { DEMO_PAGE } from '../src/data/pages.ts';
import { SITE_URL } from '../src/lib/links.ts';

const demo = new URL('../../web/dist-demo/', import.meta.url);
const dist = new URL('../dist/', import.meta.url);
const target = new URL('demo/', dist);

if (!existsSync(new URL('index.html', demo))) {
  throw new Error(
    'No demo build in apps/web/dist-demo. Run `pnpm --filter @bemmoly/web build:demo` first, ' +
      'or build the site through Turborepo (`pnpm turbo run build --filter @bemmoly/site`).',
  );
}
rmSync(target, { recursive: true, force: true });
cpSync(demo, target, { recursive: true });

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
/** The home page's share card, hashed by Astro, so the demo shares the same picture. */
const home = readFileSync(new URL('index.html', dist), 'utf8');
const image = /<meta property="og:image" content="([^"]+)"/.exec(home)?.[1];
if (!image) throw new Error('The home page has no og:image to share the demo with.');

const address = new URL(DEMO_PAGE.path, SITE_URL).href;
const head = [
  `<title>${escape(DEMO_PAGE.title)}</title>`,
  `<meta name="description" content="${escape(DEMO_PAGE.description)}" />`,
  `<link rel="canonical" href="${address}" />`,
  '<meta property="og:type" content="website" />',
  '<meta property="og:site_name" content="Bemmoly" />',
  `<meta property="og:title" content="${escape(DEMO_PAGE.title)}" />`,
  `<meta property="og:description" content="${escape(DEMO_PAGE.description)}" />`,
  `<meta property="og:url" content="${address}" />`,
  `<meta property="og:image" content="${image}" />`,
  '<meta name="twitter:card" content="summary_large_image" />',
].join('\n    ');

const page = new URL('index.html', target);
const source = readFileSync(page, 'utf8');
const titled = source.replace(/<meta name="description"[^>]*>\s*<title>[^<]*<\/title>/, head);
if (titled === source) throw new Error('The demo page has no description and title to replace.');
writeFileSync(page, titled);
// The precompressed copies would serve the old head.
rmSync(new URL('index.html.br', target), { force: true });
rmSync(new URL('index.html.gz', target), { force: true });
