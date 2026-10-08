import type { ModuleAccessChoice, ModuleId } from '@bemmoly/shared';
import type { Actor } from './authz.ts';

/**
 * Layer one of authorization: which enabled modules an actor may see, from
 * module_grants (everyone, team, role or person). The web shell's module list,
 * search, mentions, notifications and AI context filter by this set.
 */
export interface ModuleAccessResolver {
  modulesFor(actor: Actor): Promise<ReadonlySet<ModuleId>>;
  canAccess(actor: Actor, moduleId: ModuleId): Promise<boolean>;
}

/**
 * Writes the access an admin chose when enabling a module. The module's own
 * `defaultAccess` is only a suggestion shown to the admin; nothing is granted
 * that the admin did not choose.
 */
export interface ModuleAccessWriter {
  /** Refuses a choice that names a team that does not exist, before anything changes. */
  check(access: ModuleAccessChoice): Promise<void>;
  /** Adds the chosen grants; grants the module already holds stay as they are. */
  apply(moduleId: ModuleId, access: ModuleAccessChoice, actor: Actor): Promise<void>;
}
