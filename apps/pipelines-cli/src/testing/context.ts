import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Context } from '../cli/context.ts';
import { memoryOutput } from '../cli/output.ts';
import { parseEnv } from '../config/env.ts';

/** A context with a private config folder, a fake clock and in-memory files. */
export async function testContext(
  fetch: typeof globalThis.fetch,
  env: Record<string, string> = {},
  files: Record<string, string> = {},
) {
  const configHome = await mkdtemp(join(tmpdir(), 'bp-test-'));
  const output = memoryOutput();
  let clock = Date.parse('2026-10-17T10:00:00Z');
  const ctx: Context = {
    env: parseEnv({ XDG_CONFIG_HOME: configHome, ...env }),
    output,
    fetch,
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
    hostname: 'build-box',
    readFile: async (path) => {
      const text = files[path];
      if (text === undefined) throw new Error(`ENOENT: ${path}`);
      return text;
    },
  };
  return { ctx, output };
}
