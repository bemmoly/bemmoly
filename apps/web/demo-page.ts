import type { Plugin } from 'vite';

/** Where bemmoly.com serves the demo build. */
export const DEMO_BASE = '/demo/';

/** The icons the page links. */
const ICONS = new Set(['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png']);

/**
 * The demo build's index.html: the brand links follow the base, and the install's web
 * manifest goes (its scope is an install, not a page of bemmoly.com). The site gives the page
 * its title, description and share card when it bundles the build (apps/site
 * scripts/bundle-demo.ts), from the same list as its own pages.
 */
export function demoPage(): Plugin {
  return {
    name: 'bemmoly-demo-page',
    apply: 'build',
    config: () => ({ build: { copyPublicDir: false } }),
    /** Runs after brand-assets.ts copied the brand folder: the banners stay out of the demo. */
    generateBundle(_options, bundle) {
      for (const name of Object.keys(bundle)) {
        if (name.startsWith('brand/') && !ICONS.has(name.slice('brand/'.length))) {
          delete bundle[name];
        }
      }
    },
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html
          .replace(/(href|src)="\/brand\//g, `$1="${DEMO_BASE}brand/`)
          .replace(/\s*<link rel="manifest"[^>]*>/, ''),
    },
  };
}
