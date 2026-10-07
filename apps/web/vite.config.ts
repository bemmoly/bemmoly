import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { brandAssets } from './brand-assets.ts';
import { precompress } from './precompress.ts';

const server = 'http://localhost:8080';
const generatedBrand = fileURLToPath(
  new URL('../../packages/ui/assets/brand/generated', import.meta.url),
);

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), brandAssets(generatedBrand), precompress()],
  define: {
    /** The in-memory mock backend runs under the dev server only and is compiled out of builds. */
    __MOCK_API__: JSON.stringify(command === 'serve'),
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': server,
      '/healthz': server,
      '/readyz': server,
      '/ws': { target: server.replace('http', 'ws'), ws: true },
    },
  },
  build: {
    target: 'es2024',
    sourcemap: true,
  },
}));
