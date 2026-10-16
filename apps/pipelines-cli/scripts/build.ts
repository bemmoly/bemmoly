import { build } from 'esbuild';

/*
 * One file to ship: dist/bp.mjs runs on any Node 24 with no install step, for release
 * assets and CI images. In this repository `node src/bin.ts` runs the source directly.
 */
await build({
  entryPoints: ['src/bin.ts'],
  outfile: 'dist/bp.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  minify: false,
  legalComments: 'none',
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});
