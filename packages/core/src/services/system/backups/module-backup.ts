import type { ModuleDataBackup } from '../../../contracts/module-backup.ts';
import type { SystemDependencies } from '../deps.ts';
import { runBackup } from './run-backup.ts';
import { verifyBackup } from './verify.ts';

export class ModuleBackupError extends Error {
  override readonly name = 'ModuleBackupError';
}

/**
 * "Remove data" for a module runs its down changesets, so it waits for a backup that
 * exists, passed pg_restore --list and re-reads its checksums. The host passes this as
 * the identity wiring's `backup`.
 */
export function createModuleDataBackup(deps: SystemDependencies): ModuleDataBackup {
  return {
    async backupBeforeRemoval({ moduleId, actor }) {
      deps.logger.warn({ moduleId, actor: actor.id }, 'backing up before removing module data');
      const backup = await runBackup(deps, {
        kind: 'manual',
        ...(actor.userId ? { createdBy: actor.userId } : {}),
      });
      const verified = await verifyBackup(deps, backup.id, 'list');
      if (!verified.ok) {
        throw new ModuleBackupError(
          `The backup before removing ${moduleId} data did not verify: ${verified.message}`,
        );
      }
      return { backupId: backup.id };
    },
  };
}
