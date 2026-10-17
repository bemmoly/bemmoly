import { ValidationError } from '@bemmoly/shared';
import type { ControlPlaneClient } from '../clients/control-plane.ts';
import type { SplitConfig } from '../config/env.ts';
import { expandGlobs } from '../utils/glob.ts';

/**
 * `bemmoly-runner split <glob>...` inside a sharded step: every shard expands the same globs,
 * sends the same list, and gets back its own part, balanced by past timings.
 */
export async function splitFiles(
  patterns: readonly string[],
  cwd: string,
  config: SplitConfig,
  client: ControlPlaneClient,
): Promise<string[]> {
  if (patterns.length === 0) {
    throw new ValidationError(
      'Name the test files to split, for example: split "src/**/*.test.ts"',
    );
  }
  const files = await expandGlobs(patterns, cwd);
  if (files.length === 0) return [];
  const answer = await client.splits(
    { jobId: config.BEMMOLY_JOB_ID, jobToken: config.BEMMOLY_JOB_TOKEN },
    files,
  );
  return answer.files;
}
