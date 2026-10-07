import { formatDateTime } from '@bemmoly/core-web';
import type { UpdateStatus } from '@bemmoly/shared';

type Previous = NonNullable<UpdateStatus['previous']>;

export interface RollbackCopy {
  /** "Code rollback", "Schema rollback", "Restore rollback". */
  mode: string;
  body: string;
  /** Restore rollbacks lose writes since the update; the page offers their audit rows first. */
  exportSince: string | null;
}

/** What a rollback does and loses, named before the admin confirms, per the changelog's mode. */
export function rollbackCopy(previous: Previous): RollbackCopy {
  const { version } = previous;
  if (previous.rollbackMode === 'schema') {
    const fields = previous.droppedFields;
    return {
      mode: 'Schema rollback',
      body:
        `Bemmoly reverses this update's schema changes, then swaps back to ${version}. ` +
        (fields.length
          ? `Fields added since the update are dropped with their data: ${fields.join(', ')}. Everything else stays.`
          : 'No fields hold data yet, so nothing is lost.'),
      exportSince: null,
    };
  }
  if (previous.rollbackMode === 'restore') {
    const count = previous.discardCount ?? 0;
    return {
      mode: 'Restore rollback',
      body:
        `This update cannot be reversed in place, so Bemmoly restores the backup taken before it. ` +
        `Restoring ${version} will discard ${count} change${count === 1 ? '' : 's'} made since ` +
        `${formatDateTime(previous.updatedAt)}. The current database is kept for the retention window.`,
      exportSince: previous.updatedAt,
    };
  }
  return {
    mode: 'Code rollback',
    body:
      `Bemmoly swaps back to the ${version} image without touching the database, so nothing is ` +
      `lost: everything people did since the update stays.`,
    exportSince: null,
  };
}

/** How "Update to X" runs on this install, in one or two sentences. */
export function updateModeCopy(mode: UpdateStatus['mode']): string {
  if (mode === 'in_app') {
    return 'Bemmoly backs up first, then swaps to the new version and runs its changesets. Downtime is usually under a minute; this page shows the progress and the result.';
  }
  if (mode === 'kubernetes') {
    return 'The pod cannot replace itself. Run this where you manage the Helm release:';
  }
  return 'In-app updates are off on this install. Run this on the server:';
}
