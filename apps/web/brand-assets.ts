import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { Plugin } from 'vite';

const TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/**
 * Serves packages/ui/assets/brand/generated/* at /brand/* in development and
 * copies the files into the build, so favicon, apple-touch-icon and the PWA
 * manifest icons change whenever the design system regenerates them.
 */
export function brandAssets(directory: string): Plugin {
  const files = () =>
    existsSync(directory) ? readdirSync(directory).filter((name) => extname(name) in TYPES) : [];
  return {
    name: 'bemmoly-brand-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const match = /^\/brand\/([\w.-]+)$/.exec(request.url?.split('?')[0] ?? '');
        const file = match?.[1] ? join(directory, match[1]) : null;
        if (!file || !existsSync(file)) return next();
        response.writeHead(200, {
          'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
          'cache-control': 'no-cache',
        });
        response.end(readFileSync(file));
      });
    },
    generateBundle() {
      const found = files();
      if (found.length === 0) {
        this.warn(
          `no generated brand icons in ${directory}; run the design system's brand:icons script`,
        );
      }
      for (const name of found) {
        this.emitFile({
          type: 'asset',
          fileName: `brand/${name}`,
          source: readFileSync(join(directory, name)),
        });
      }
    },
  };
}
