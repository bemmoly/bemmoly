import type { Plugin } from 'vite';

/** Where bemmoly.com serves the demo build. */
export const DEMO_BASE = '/demo/';

const PAGE_ICONS = new Set(['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png']);

const TITLE = 'Live demo: Bemmoly issues, boards and sprints';
const DESCRIPTION =
  'Click through Bemmoly in your browser: a sprint board, the backlog, issues and the workflow ' +
  'editor, on sample data that resets when you reload. Nothing to install.';

/**
 * The demo build's index.html: the brand links follow the base, the install's web manifest
 * goes (its scope is an install, not a page of bemmoly.com), and the page gets its own title,
 * description and canonical address. The landing route is the one indexable demo page; the
 * site's Caddyfile marks every other path under the base noindex.
 */
export function demoPage(): Plugin {
  return {
    name: 'bemmoly-demo-page',
    apply: 'build',
    config: () => ({ build: { copyPublicDir: false } }),
    /** The page links three icons; the banners and social cards brand-assets.ts copies stay out. */
    generateBundle(_options, bundle) {
      for (const name of Object.keys(bundle)) {
        if (name.startsWith('brand/') && !PAGE_ICONS.has(name.slice('brand/'.length))) {
          delete bundle[name];
        }
      }
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html
          .replace(/(href|src)="\/brand\//g, `$1="${DEMO_BASE}brand/`)
          .replace(/\s*<link rel="manifest"[^>]*>/, '')
          .replace(/<title>[^<]*<\/title>/, `<title>${TITLE}</title>`)
          .replace(
            /<meta name="description" content="[^"]*"\s*\/?>/,
            `<meta name="description" content="${DESCRIPTION}" />` +
              `\n    <link rel="canonical" href="https://bemmoly.com${DEMO_BASE.slice(0, -1)}" />`,
          );
      },
    },
  };
}
