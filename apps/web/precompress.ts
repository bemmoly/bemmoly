import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import type { Plugin, ResolvedConfig } from 'vite';

const COMPRESSIBLE = new Set([
  '.js',
  '.css',
  '.html',
  '.svg',
  '.json',
  '.webmanifest',
  '.map',
  '.txt',
]);
const MIN_BYTES = 1024;

function* files(directory: string): Generator<string> {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

/**
 * Writes `.br` and `.gz` beside every compressible build file, so the server
 * sends precompressed bytes (@fastify/static `preCompressed`) with no CPU cost
 * per request. A variant is kept only when it is smaller than the original.
 */
export function precompress(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'bemmoly-precompress',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    closeBundle() {
      const outDir = join(config.root, config.build.outDir);
      for (const path of files(outDir)) {
        if (!COMPRESSIBLE.has(extname(path))) continue;
        const source = readFileSync(path);
        if (source.length < MIN_BYTES) continue;
        const brotli = brotliCompressSync(source, {
          params: {
            [constants.BROTLI_PARAM_QUALITY]: 11,
            [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
          },
        });
        const gzip = gzipSync(source, { level: 9 });
        if (brotli.length < source.length) writeFileSync(`${path}.br`, brotli);
        if (gzip.length < source.length) writeFileSync(`${path}.gz`, gzip);
      }
    },
  };
}
