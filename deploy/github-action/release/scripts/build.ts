import { build } from 'esbuild';

/*
 * GitHub runs an action's main file with its own Node, with no install step, so the action
 * ships as one bundled file. Built when the action is published to bemmoly/release.
 */
await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/index.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  legalComments: 'none',
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});
