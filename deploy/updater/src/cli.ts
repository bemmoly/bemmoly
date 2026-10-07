/**
 * One-shot mode, used by `bemmoly upgrade` and `bemmoly rollback` on the host (and on
 * installs without the in-app updater): the same flows as the service, run in a
 * throwaway updater container, printing progress as it goes.
 *
 *   updater-cli upgrade <version> | rollback [--prefer-restore] [--expect code|schema|restore] | status | prune
 */
import { parseArgs } from 'node:util';
import { createDockerClient } from './clients/docker.ts';
import { loadUpdaterEnv } from './config/env.ts';
import type { UpdaterContext } from './services/context.ts';
import { pruneImages } from './services/images.ts';
import { runRollback } from './services/rollback.ts';
import { readState } from './services/state.ts';
import { runUpdate } from './services/update.ts';

const MODES = new Set(['code', 'schema', 'restore']);

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { 'prefer-restore': { type: 'boolean' }, expect: { type: 'string' } },
  });
  const env = loadUpdaterEnv();
  const ctx: UpdaterContext = {
    env,
    docker: createDockerClient(),
    now: () => new Date(),
    log: (message) => process.stdout.write(`→ ${message}\n`),
  };
  const [command, argument] = positionals;
  switch (command) {
    case 'upgrade': {
      if (!argument) throw new Error('Usage: upgrade <version>');
      const state = await runUpdate(ctx, argument);
      process.stdout.write(`${state.message ?? 'done'}\n`);
      return state.current === argument ? 0 : 3;
    }
    case 'rollback': {
      const expect = values.expect;
      if (expect && !MODES.has(expect)) throw new Error('--expect takes code, schema or restore');
      const state = await runRollback(ctx, {
        preferRestore: Boolean(values['prefer-restore']),
        ...(expect ? { expectedMode: expect as 'code' | 'schema' | 'restore' } : {}),
      });
      process.stdout.write(`${state.message ?? 'done'}\n`);
      return 0;
    }
    case 'status':
      process.stdout.write(`${JSON.stringify(await readState(env.BEMMOLY_DIR), null, 2)}\n`);
      return 0;
    case 'prune': {
      const removed = await pruneImages(ctx, await readState(env.BEMMOLY_DIR));
      process.stdout.write(
        removed.length ? `removed ${removed.join(', ')}\n` : 'nothing to remove\n',
      );
      return 0;
    }
    default:
      process.stderr.write(
        'Usage: updater-cli upgrade <version> | rollback [--prefer-restore] [--expect <mode>] | status | prune\n',
      );
      return 2;
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    process.stderr.write(`✗ ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  },
);
