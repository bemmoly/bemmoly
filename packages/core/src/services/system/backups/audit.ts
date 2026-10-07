import { createTransactionDatabase } from '../../../clients/drizzle.ts';
import type { Actor } from '../../../contracts/authz.ts';
import { recordAudit, type RequestMeta } from '../../audit/index.ts';
import type { SystemDependencies } from '../deps.ts';
import { createBackupRepository, type BackupRepository } from './repository.ts';

/** Who asked for a backup, a restore or a check, for the audit row it leaves. */
export interface BackupAudit {
  actor: Actor;
  meta?: RequestMeta;
}

export type BackupAction =
  'backup.started' | 'backup.restored' | 'backup.restore_failed' | 'backup.verified';

export interface BackupAuditEntry {
  action: BackupAction;
  backupId: string;
  before?: unknown;
  after: unknown;
}

/**
 * Runs a write to the backups table and its audit row in one transaction, so
 * the list and the audit log never disagree about what happened.
 */
export async function withBackupAudit<T>(
  deps: SystemDependencies,
  audit: BackupAudit,
  work: (repository: BackupRepository) => Promise<T>,
  describe: (result: T) => BackupAuditEntry,
): Promise<T> {
  const result = await deps.sql.begin(async (tx) => {
    const value = await work(createBackupRepository(tx));
    const entry = describe(value);
    await recordAudit(createTransactionDatabase(deps.sql, tx), {
      actor: audit.actor,
      action: entry.action,
      target: { kind: 'backup', id: entry.backupId },
      ...(entry.before === undefined ? {} : { before: entry.before }),
      after: entry.after,
      ...(audit.meta ? { meta: audit.meta } : {}),
    });
    return value;
  });
  return result as T;
}

/** An audit row with no backups-table write beside it: a restore, written once it is done. */
export async function recordBackupAudit(
  deps: SystemDependencies,
  audit: BackupAudit,
  entry: BackupAuditEntry,
): Promise<void> {
  await withBackupAudit(
    deps,
    audit,
    async () => undefined,
    () => entry,
  );
}
