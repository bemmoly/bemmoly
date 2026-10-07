import type { ModuleId } from '@bemmoly/shared';
import type { Actor } from './authz.ts';

/**
 * Called before "remove data" runs a module's down changesets. Implemented by
 * the backups service; resolves once a verified backup exists.
 */
export interface ModuleDataBackup {
  backupBeforeRemoval(input: { moduleId: ModuleId; actor: Actor }): Promise<{ backupId: string }>;
}
