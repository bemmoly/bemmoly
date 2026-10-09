import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';
import { fileURLToPath } from 'node:url';
import { PAGES } from './src/data/pages.ts';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const site = 'https://bemmoly.com';
/** lastmod is the day a page's words last changed (src/data/pages.ts), never the build time. */
const updated = new Map<string, string>(
  PAGES.map((page) => [new URL(page.path, site).href, page.updated]),
);

export default defineConfig({
  site,
  trailingSlash: 'never',
  // Astro 7's default ('jsx') drops the space where a line ends beside a link or <code>
  // ("go after<code>"); lossless compression keeps the text as written.
  compressHTML: true,
  build: {
    format: 'file',
    // Pages are small; inlining the stylesheet removes the only render-blocking request.
    inlineStylesheets: 'always',
  },
  env: {
    schema: {
      // Search Console and Bing Webmaster Tools tokens, for the HTML-tag verification method
      // only (README: Search engines). Empty by default: DNS verification needs no code.
      SITE_GOOGLE_VERIFICATION: envField.string({
        context: 'server',
        access: 'public',
        default: '',
      }),
      SITE_BING_VERIFICATION: envField.string({ context: 'server', access: 'public', default: '' }),
    },
  },
  integrations: [
    sitemap({
      // The 404 page is served but is not a destination.
      filter: (page) => updated.has(page),
      serialize: (item) => ({ url: item.url, lastmod: updated.get(item.url) }),
    }),
  ],
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    // Icons and fonts stay files with stable hashed URLs instead of data: URIs in every page.
    build: { assetsInlineLimit: 0 },
    // The security page renders SECURITY.md; the changelog reads the packages' CHANGELOG.md.
    server: { fs: { allow: [repoRoot] } },
  },
});
