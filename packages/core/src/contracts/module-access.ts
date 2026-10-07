import type { ModuleId } from '@bemmoly/shared';
import type { Actor } from './authz.ts';

/** Mirrors BemmolyModule.defaultAccess: the grant written when a module is first enabled. */
export type ModuleDefaultAccessKind = 'everyone' | 'teams' | 'none';

/**
 * Layer 1 of authorization (tech design 4, who can see a module), backed by
 * module_grants. Implemented by the authz service; the module list, module
 * route gate and realtime subscriptions ask it before anything else.
 */
export interface ModuleAccessResolver {
  /** The subset of `moduleIds` the actor may see, in the given order. */
  accessibleModules(actor: Actor, moduleIds: readonly ModuleId[]): Promise<ModuleId[]>;
  /** Writes the module's initial grant when it is enabled for the first time. */
  seedDefaultAccess(
    moduleId: ModuleId,
    defaultAccess: ModuleDefaultAccessKind,
    actor: Actor,
  ): Promise<void>;
}

/**
 * Called before "remove data" drops a module's tables. Implemented by the
 * backups service; resolves once a verified backup exists.
 */
export interface ModuleDataBackup {
  backupBeforeRemoval(input: { moduleId: ModuleId; actor: Actor }): Promise<{ backupId: string }>;
}
