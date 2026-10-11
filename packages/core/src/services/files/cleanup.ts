import type { SqlClient } from '../../clients/postgres.ts';
import type { Logger } from '../../config/logger.ts';
import type { ObjectStore } from '../../contracts/object-store.ts';
import type { FileTargetDefinition } from '../../modules/files.ts';
import type { FromModule } from '../../modules/registry.ts';

/** An upload is kept this long before it counts as abandoned: an undo can bring it back. */
export const FILE_GRACE_HOURS = 24;
const BATCH = 500;

export interface CleanupDeps {
  sql: SqlClient;
  store: ObjectStore;
  targets: () => readonly FromModule<FileTargetDefinition>[];
  isEnabled?: (moduleId: string) => boolean;
  logger: Logger;
}

/**
 * Deletes files past the grace period that their module's content no longer refers to,
 * then the stored bytes once no other file row shares them. Kinds whose module is absent
 * or disabled are left alone: their content cannot be asked, so nothing is assumed.
 */
export async function cleanupFiles(deps: CleanupDeps, now: Date): Promise<number> {
  const before = new Date(now.getTime() - FILE_GRACE_HOURS * 3_600_000).toISOString();
  let removed = 0;
  for (const target of deps.targets()) {
    if (deps.isEnabled && !deps.isEnabled(target.moduleId)) continue;
    let after = '00000000-0000-0000-0000-000000000000';
    for (;;) {
      const rows = await deps.sql<{ id: string; storage_key: string }[]>`
        select id, storage_key from files
        where target_kind = ${target.kind} and created_at < ${before}::timestamptz
          and id > ${after}
        order by id limit ${BATCH}`;
      if (rows.length === 0) break;
      after = rows.at(-1)!.id;
      const kept = await target.referenced(rows.map((row) => row.id));
      const orphans = rows.filter((row) => !kept.has(row.id));
      if (orphans.length === 0) continue;
      const deleted = await deps.sql<{ storage_key: string }[]>`
        delete from files where id in ${deps.sql(orphans.map((row) => row.id))}
        returning storage_key`;
      removed += deleted.length;
      for (const key of new Set(deleted.map((row) => row.storage_key))) {
        const [shared] = await deps.sql`select 1 from files where storage_key = ${key} limit 1`;
        if (!shared) await deps.store.delete(key);
      }
    }
  }
  if (removed > 0) deps.logger.info({ removed }, 'unreferenced files deleted');
  return removed;
}
