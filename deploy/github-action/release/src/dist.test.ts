import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { expect, it } from 'vitest';
import { bundleOptions } from '../scripts/bundle.ts';

it('the committed dist/index.mjs is what a build of the source makes', async () => {
  const result = await build({ ...bundleOptions, write: false });
  const built = result.outputFiles[0]?.text;
  const committed = await readFile(bundleOptions.outfile, 'utf8');
  // Run `pnpm --filter @bemmoly/release-action build` and commit dist/ when this fails.
  expect(built === committed, 'dist/index.mjs is stale').toBe(true);
}, 30_000);
