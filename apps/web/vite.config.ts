import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { bootFrame } from './boot-frame.ts';
import { brandAssets } from './brand-assets.ts';
import { demoPage, DEMO_BASE } from './demo-page.ts';
import { precompress } from './precompress.ts';

const server = 'http://localhost:8080';
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as {
  version: string;
};
const brand = (path: string) =>
  fileURLToPath(new URL(`../../packages/ui/assets/brand/${path}`, import.meta.url));

export default defineConfig(({ command, mode }) => {
  /**
   * `vite build --mode demo`: the public demo the marketing site serves at /demo. The same
   * shell on the in-browser mock backend, with no server behind it (src/demo).
   */
  const demo = mode === 'demo';
  return {
    base: demo ? DEMO_BASE : '/',
    plugins: [
      react(),
      tailwindcss(),
      brandAssets(brand('generated')),
      bootFrame({
        logo: brand('lockup-color.svg'),
        app: fileURLToPath(new URL('./src/mount.tsx', import.meta.url)),
      }),
      demo ? demoPage() : null,
      precompress(),
    ],
    define: {
      /** The in-memory mock backend runs under the dev server and in the demo build only. */
      __MOCK_API__: JSON.stringify(command === 'serve' || demo),
      __DEMO__: JSON.stringify(demo),
      /** The release this build is: the changesets tool writes it into package.json. */
      __APP_VERSION__: JSON.stringify(version),
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': server,
        '/healthz': server,
        '/readyz': server,
        '/ws': { target: server.replace('http', 'ws'), ws: true },
        '/collab': { target: server.replace('http', 'ws'), ws: true },
      },
    },
    build: {
      target: 'es2024',
      outDir: demo ? 'dist-demo' : 'dist',
      sourcemap: !demo,
    },
  };
});
