import type { ChangesetContextName } from '../../contracts/changelog.ts';
import { decide } from './apply.ts';
import { createPlanContext, type ChangelogLogger } from './context.ts';
import { describeCheck, firstFailing } from './preconditions.ts';
import { isIrreversible, isSlow, type ChangelogSource } from './sources.ts';
import { readHistory, type Connection } from './store.ts';

export interface PlannedChangeset {
  module: string;
  id: string;
  description: string;
  transactional: boolean;
  slow: boolean;
  irreversible: boolean;
  /** What update would do: run it, or the precondition's onFail outcome. */
  action: 'run' | 'markRan' | 'skip' | 'halt' | 'warn';
  note?: string;
  statements: string[];
}

export interface PlanState {
  connection: Connection;
  sources: readonly ChangelogSource[];
  contexts: readonly ChangesetContextName[];
  services: Readonly<Record<string, unknown>>;
  logger: ChangelogLogger;
}

/**
 * The SQL `update` would run, without running it (Liquibase's updateSQL).
 * Everything happens in a read-only transaction that is rolled back.
 */
export async function planChangesets(state: PlanState): Promise<PlannedChangeset[]> {
  const { connection } = state;
  const history = await readHistory(connection);
  const rows = new Map(history.map((row) => [`${row.module}/${row.id}`, row]));
  const planned: PlannedChangeset[] = [];
  await connection.unsafe('begin transaction read only');
  try {
    for (const source of state.sources) {
      for (const changeset of source.changelog) {
        const row = rows.get(`${source.module}/${changeset.id}`);
        let decision;
        try {
          decision = decide(source.module, changeset, row, state.contexts, true);
        } catch (error) {
          planned.push({
            module: source.module,
            id: changeset.id,
            description: changeset.description,
            transactional: changeset.transactional ?? true,
            slow: isSlow(changeset),
            irreversible: isIrreversible(changeset),
            action: 'halt',
            note: error instanceof Error ? error.message : String(error),
            statements: [],
          });
          continue;
        }
        if (decision.action !== 'run') continue;
        const entry: PlannedChangeset = {
          module: source.module,
          id: changeset.id,
          description: changeset.description,
          transactional: changeset.transactional ?? true,
          slow: isSlow(changeset),
          irreversible: isIrreversible(changeset),
          action: 'run',
          statements: [],
        };
        const failing = await firstFailing(connection, changeset.preconditions);
        if (failing) {
          entry.action = failing.onFail;
          entry.note = `precondition ${describeCheck(failing)} does not hold`;
        }
        if (entry.action === 'run' || entry.action === 'warn') {
          const key = { module: source.module, id: changeset.id };
          await changeset.up(createPlanContext({ ...state, key, statements: entry.statements }));
        }
        if (entry.statements.some((statement) => statement.startsWith('-- backfill'))) {
          entry.slow = true;
        }
        planned.push(entry);
      }
    }
  } finally {
    await connection.unsafe('rollback');
  }
  return planned;
}
