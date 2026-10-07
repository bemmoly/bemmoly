import type { ChangelogEntry, Changeset, ChangesetContextName } from '../../contracts/changelog.ts';
import { checksumOf } from './checksum.ts';
import { createExecuteContext, type ChangelogLogger } from './context.ts';
import { ChangelogError } from './errors.ts';
import { describeCheck, firstFailing } from './preconditions.ts';
import { matchesContexts } from './sources.ts';
import {
  finishChangeset,
  recordChangeset,
  updateChecksum,
  type Connection,
  type HistoryRow,
} from './store.ts';
import { acceptsChecksum } from './validate.ts';

export interface ApplyState {
  connection: Connection;
  appVersion: string;
  contexts: readonly ChangesetContextName[];
  services: Readonly<Record<string, unknown>>;
  logger: ChangelogLogger;
  retryStarted: boolean;
}

export type Decision =
  | { action: 'run' }
  | { action: 'skip'; reason: 'already_ran' | 'context' }
  | { action: 'accept_checksum' };

function isApplied(row: HistoryRow | undefined): row is HistoryRow {
  return row?.state === 'ran' || row?.state === 'marked_ran';
}

/** Whether a changeset is pending, already applied, or must stop the run. */
export function decide(
  module: string,
  changeset: Changeset,
  row: HistoryRow | undefined,
  contexts: readonly ChangesetContextName[],
  retryStarted: boolean,
): Decision {
  if (!matchesContexts(changeset, contexts)) return { action: 'skip', reason: 'context' };
  if (row?.state === 'started' && !retryStarted) {
    throw new ChangelogError(
      'started_unfinished',
      `${module}/${changeset.id} started on ${row.executedAt.toISOString()} and never finished. ` +
        'Check the database, then run `db update --retry-started` to run it again.',
    );
  }
  if (!isApplied(row)) return { action: 'run' };
  const current = checksumOf(changeset);
  if (current === row.checksum) {
    return changeset.runAlways ? { action: 'run' } : { action: 'skip', reason: 'already_ran' };
  }
  if (changeset.runOnChange || changeset.runAlways) return { action: 'run' };
  if (acceptsChecksum(changeset, row.checksum)) return { action: 'accept_checksum' };
  throw new ChangelogError(
    'checksum_mismatch',
    `${changeset.source?.file ?? `${module}/${changeset.id}`} changed after it ran ` +
      `(recorded ${row.checksum}, now ${current}). Revert the edit, or list the recorded ` +
      'checksum in validChecksums with the reason.',
    { details: { module, id: changeset.id, recorded: row.checksum, current } },
  );
}

function recordInput(module: string, changeset: Changeset, state: ApplyState) {
  return {
    module,
    id: changeset.id,
    author: changeset.author,
    description: changeset.description,
    checksum: checksumOf(changeset),
    appVersion: state.appVersion,
    contexts: changeset.contexts ?? ['*'],
  };
}

async function runUp(
  module: string,
  changeset: Changeset,
  row: HistoryRow | undefined,
  state: ApplyState,
): Promise<ChangelogEntry> {
  const { connection } = state;
  const key = { module, id: changeset.id };
  const progress = row?.state === 'started' ? row.progress : {};
  const started = performance.now();
  const ctx = createExecuteContext({ ...state, key, progress });
  const elapsed = () => Math.round(performance.now() - started);
  const input = {
    ...recordInput(module, changeset, state),
    state: 'started' as const,
    executionMs: 0,
  };
  if (changeset.transactional === false) {
    // Committed first, so a crash leaves a visible "started" row, not "pending".
    await recordChangeset(connection, input);
    await changeset.up(ctx);
    return finishChangeset(connection, key, 'ran', elapsed());
  }
  await connection.unsafe('begin');
  try {
    await recordChangeset(connection, input);
    await changeset.up(ctx);
    const entry = await finishChangeset(connection, key, 'ran', elapsed());
    await connection.unsafe('commit');
    return entry;
  } catch (error) {
    await connection.unsafe('rollback');
    throw error;
  }
}

/** Applies one pending changeset: preconditions, then `up` and its row. */
export async function applyChangeset(
  module: string,
  changeset: Changeset,
  row: HistoryRow | undefined,
  state: ApplyState,
): Promise<ChangelogEntry | undefined> {
  const key = { module, id: changeset.id };
  const failing = await firstFailing(state.connection, changeset.preconditions);
  if (failing) {
    const details = { ...key, precondition: describeCheck(failing), onFail: failing.onFail };
    switch (failing.onFail) {
      case 'halt':
        throw new ChangelogError(
          'precondition_failed',
          `${module}/${changeset.id}: precondition ${details.precondition} failed` +
            (failing.reason ? ` (${failing.reason})` : ''),
          { details },
        );
      case 'skip':
        state.logger.warn(details, 'precondition failed; changeset skipped for this run');
        return undefined;
      case 'markRan':
        state.logger.info(details, 'precondition failed; changeset marked as ran');
        return recordChangeset(state.connection, {
          ...recordInput(module, changeset, state),
          state: 'marked_ran',
          executionMs: 0,
        });
      case 'warn':
        state.logger.warn(details, 'precondition failed; running anyway');
    }
  }
  try {
    const entry = await runUp(module, changeset, row, state);
    state.logger.info({ ...key, executionMs: entry.executionMs }, 'changeset applied');
    return entry;
  } catch (error) {
    if (error instanceof ChangelogError) throw error;
    throw new ChangelogError(
      'changeset_failed',
      `${module}/${changeset.id} failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

export async function acceptChecksum(
  module: string,
  changeset: Changeset,
  state: ApplyState,
): Promise<void> {
  await updateChecksum(state.connection, { module, id: changeset.id }, checksumOf(changeset));
  state.logger.warn({ module, id: changeset.id }, 'accepted changed checksum via validChecksums');
}
