import { ProcessError, runProcess, type ChangelogProbe, type ChangesetTraits } from '@bemmoly/core';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The changelog runner's command line, next to this file in the image and the checkout. */
export const DB_CLI = fileURLToPath(new URL('../../src/cli.ts', import.meta.url));

const TIMEOUT_MS = 60 * 60_000;

interface RollbackStep {
  module: string;
  id: string;
  reversible: boolean;
}

interface HistoryRow {
  tag: string | null;
  orderExecuted: number;
}

/**
 * The system service's view of the changelog, through `cli.ts db … --json`, which is
 * also what the updater and `bemmoly db` run. Undefined when the image has no runner.
 */
export function createCliChangelogProbe(env: {
  databaseUrl: string;
  modules: readonly string[];
}): ChangelogProbe | undefined {
  if (!existsSync(DB_CLI)) return undefined;
  const childEnv = { DATABASE_URL: env.databaseUrl, BEMMOLY_MODULES: env.modules.join(',') };
  const db = async (args: string[]): Promise<{ ok: boolean; stdout: string }> => {
    try {
      const { stdout } = await runProcess(process.execPath, [DB_CLI, 'db', ...args, '--json'], {
        env: childEnv,
        timeoutMs: TIMEOUT_MS,
      });
      return { ok: true, stdout };
    } catch (error) {
      if (error instanceof ProcessError && error.exitCode === 1)
        return { ok: false, stdout: error.stdout };
      throw error;
    }
  };
  return {
    async changesSince(tag) {
      // Exit 1 with a plan means something is irreversible; exit 1 with text means no such tag.
      const { stdout } = await db(['rollback', '--to-tag', tag, '--dry-run']);
      if (stdout.trimStart().startsWith('error:')) return null;
      const plan = JSON.parse(stdout) as { steps: RollbackStep[] };
      return plan.steps.map((step): ChangesetTraits => ({
        module: step.module,
        id: step.id,
        hasDown: step.reversible,
        irreversible: !step.reversible,
      }));
    },
    async latestTag() {
      const { ok, stdout } = await db(['history']);
      if (!ok) return null;
      const rows = JSON.parse(stdout) as HistoryRow[];
      const tagged = rows
        .filter((row) => row.tag)
        .sort((a, b) => b.orderExecuted - a.orderExecuted);
      return tagged[0]?.tag ?? null;
    },
    async update() {
      const { ok, stdout } = await db(['update']);
      if (!ok) throw new Error(`Pending changesets failed: ${stdout.trim().slice(-500)}`);
      return (JSON.parse(stdout) as unknown[]).length;
    },
  };
}
