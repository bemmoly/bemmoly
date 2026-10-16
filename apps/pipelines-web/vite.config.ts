import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { messageCatalogs } from '@bemmoly/i18n-tools/vite';
import { defineConfig } from 'vite';

/**
 * Bemmoly Pipelines' web app. It is served under /pipelines on the same origin as Bemmoly
 * (ADR 0037), so it shares the session cookie and the sign-in pages. In development, open
 * it through the Bemmoly dev server (http://localhost:5173/pipelines/), which proxies here.
 */
const server = 'http://localhost:8080';
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as {
  version: string;
};

export default defineConfig({
  base: '/pipelines/',
  plugins: [messageCatalogs(), react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: {
    port: 5601,
    strictPort: true,
    proxy: {
      '/api': server,
      '/healthz': server,
    },
  },
  build: {
    target: 'es2024',
    outDir: 'dist',
    sourcemap: true,
  },
});
