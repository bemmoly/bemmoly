import { ALL_MODULES, ChangelogError, type KernelChangelogRunner } from '../changelog/index.ts';
import type { ChangelogProbe, ChangesetTraits } from './deps.ts';

export interface RunnerChangelogProbeOptions {
  runner: Pick<KernelChangelogRunner, 'history' | 'rollbackPlan' | 'update'>;
  /** BEMMOLY_DB_CONTEXTS. */
  contexts: readonly string[];
  /** The enabled modules, whose changesets an update applies with the kernel's. */
  enabledModules: () => readonly string[];
}

/**
 * The system service's view of the changelog, read from the runner in this
 * process. It answers what `bemmoly-db db … --json` answers: a rollback plan to
 * the outgoing version's tag, the newest tag, and an update.
 */
export function createRunnerChangelogProbe(options: RunnerChangelogProbeOptions): ChangelogProbe {
  const { runner } = options;
  return {
    async changesSince(tag) {
      try {
        const plan = await runner.rollbackPlan(ALL_MODULES, { toTag: tag });
        return plan.steps.map((step): ChangesetTraits => ({
          module: step.module,
          id: step.id,
          hasDown: step.reversible,
          irreversible: !step.reversible,
        }));
      } catch (error) {
        if (error instanceof ChangelogError && error.kind === 'unknown_target') return null;
        throw error;
      }
    },
    async latestTag() {
      const tagged = (await runner.history())
        .filter((row) => row.tag)
        .sort((a, b) => b.orderExecuted - a.orderExecuted);
      return tagged[0]?.tag ?? null;
    },
    async update() {
      const applied = await runner.update({
        contexts: [...options.contexts],
        modules: [...options.enabledModules()],
      });
      return applied.length;
    },
  };
}
