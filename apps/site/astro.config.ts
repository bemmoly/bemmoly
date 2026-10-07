import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  site: 'https://bemmoly.com',
  trailingSlash: 'never',
  build: {
    format: 'file',
    // Pages are small; inlining the stylesheet removes the only render-blocking request.
    inlineStylesheets: 'always',
  },
  integrations: [
    sitemap({
      // The 404 page is served but is not a destination.
      filter: (page) => !page.endsWith('/404'),
      lastmod: new Date(),
      changefreq: 'weekly',
    }),
  ],
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    // Icons and fonts stay files with stable hashed URLs instead of data: URIs in every page.
    build: { assetsInlineLimit: 0 },
    // The security page renders the repository's SECURITY.md.
    server: { fs: { allow: [repoRoot] } },
  },
});
