import type { ModuleId } from '@bemmoly/shared';
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

export type ModuleDefaultAccessMode = 'everyone' | 'teams' | 'none';

/** Called by the module enable path so a newly enabled module starts with its declared access. */
export type ApplyModuleDefaultAccess = (
  module: { id: ModuleId; defaultAccess: ModuleDefaultAccessMode },
  actor: Actor,
) => Promise<void>;
