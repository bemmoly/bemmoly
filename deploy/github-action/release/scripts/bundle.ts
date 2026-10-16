import type { BuildOptions } from 'esbuild';

/*
 * GitHub runs an action's main file with its own Node, with no install step, so the action
 * ships as one bundled file, committed beside action.yml: `uses:` then works straight from
 * this repository. src/dist.test.ts fails when the committed file no longer matches a build.
 */
export const bundleOptions = {
  entryPoints: [new URL('../src/main.ts', import.meta.url).pathname],
  outfile: new URL('../dist/index.mjs', import.meta.url).pathname,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  legalComments: 'none',
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
} satisfies BuildOptions;
