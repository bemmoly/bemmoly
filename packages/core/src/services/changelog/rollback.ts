import type { ChangelogEntry, ChangelogRollbackTarget } from '../../contracts/changelog.ts';
import { createExecuteContext, type ChangelogLogger } from './context.ts';
import { ChangelogError } from './errors.ts';
import { findChangeset, type ChangelogSource } from './sources.ts';
import { markRolledBack, readHistory, type Connection, type HistoryRow } from './store.ts';

/** `*` rolls back across every module, in reverse execution order. */
export const ALL_MODULES = '*';

export interface RollbackStep {
  module: string;
  id: string;
  description: string;
  reversible: boolean;
  /** Why the step cannot run: no `down`, or the changeset is not in this image. */
  blocker?: string;
}

export interface RollbackPlan {
  steps: RollbackStep[];
  irreversible: RollbackStep[];
}

function applied(history: readonly HistoryRow[], module: string): HistoryRow[] {
  return history
    .filter((row) => row.state === 'ran' || row.state === 'marked_ran')
    .filter((row) => module === ALL_MODULES || row.module === module)
    .sort((a, b) => b.orderExecuted - a.orderExecuted);
}

/** The rows a target selects, newest first. */
export function selectTargets(
  history: readonly HistoryRow[],
  module: string,
  target: ChangelogRollbackTarget,
): HistoryRow[] {
  const candidates = applied(history, module);
  if ('count' in target) {
    if (!Number.isInteger(target.count) || target.count < 0) {
      throw new ChangelogError('unknown_target', '--count must be a whole number');
    }
    return candidates.slice(0, target.count);
  }
  if ('toId' in target) {
    const index = candidates.findIndex((row) => row.id === target.toId);
    if (index < 0) {
      throw new ChangelogError('unknown_target', `${module}/${target.toId} has not been applied`);
    }
    return candidates.slice(0, index);
  }
  const tagged = history.find((row) => row.tag === target.toTag);
  if (!tagged)
    throw new ChangelogError('unknown_target', `No changeset is tagged "${target.toTag}"`);
  return candidates.filter((row) => row.orderExecuted > tagged.orderExecuted);
}

export function planRollback(
  sources: readonly ChangelogSource[],
  targets: readonly HistoryRow[],
): RollbackPlan {
  const steps = targets.map((row): RollbackStep => {
    const changeset = findChangeset(sources, row.module, row.id);
    const base = { module: row.module, id: row.id, description: row.description };
    if (!changeset) return { ...base, reversible: false, blocker: 'not in this image' };
    if (!changeset.down) return { ...base, reversible: false, blocker: 'has no down' };
    return { ...base, reversible: true };
  });
  return { steps, irreversible: steps.filter((step) => !step.reversible) };
}

export interface RollbackState {
  connection: Connection;
  sources: readonly ChangelogSource[];
  services: Readonly<Record<string, unknown>>;
  logger: ChangelogLogger;
}

async function runDown(state: RollbackState, row: HistoryRow): Promise<void> {
  const changeset = findChangeset(state.sources, row.module, row.id);
  if (!changeset?.down) return;
  const key = { module: row.module, id: row.id };
  const ctx = createExecuteContext({ ...state, key, progress: {} });
  if (changeset.transactional === false) {
    await changeset.down(ctx);
    await markRolledBack(state.connection, key);
    return;
  }
  await state.connection.unsafe('begin');
  try {
    await changeset.down(ctx);
    await markRolledBack(state.connection, key);
    await state.connection.unsafe('commit');
  } catch (error) {
    await state.connection.unsafe('rollback');
    throw new ChangelogError(
      'changeset_failed',
      `down of ${row.module}/${row.id} failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

/**
 * Runs `down` for every selected changeset, newest first. Refuses before
 * touching anything when one of them is irreversible.
 */
export async function rollbackChangesets(
  state: RollbackState,
  module: string,
  target: ChangelogRollbackTarget,
): Promise<ChangelogEntry[]> {
  const history = await readHistory(state.connection);
  const targets = selectTargets(history, module, target);
  const plan = planRollback(state.sources, targets);
  if (plan.irreversible.length > 0) {
    const list = plan.irreversible.map((s) => `${s.module}/${s.id} (${s.blocker})`).join(', ');
    throw new ChangelogError(
      'irreversible',
      `Cannot roll back: ${list}. Restore the pre-upgrade backup instead.`,
      { details: plan.irreversible },
    );
  }
  for (const row of targets) {
    await runDown(state, row);
    state.logger.info({ module: row.module, id: row.id }, 'changeset rolled back');
  }
  return targets.map((row) => ({ ...row, state: 'rolled_back' as const }));
}
