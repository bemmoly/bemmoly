import {
  ForbiddenError,
  isKernelCapability,
  NotFoundError,
  type CapabilityName,
} from '@bemmoly/shared';
import type { Database } from '../../clients/drizzle.ts';
import type { Actor, ResourceRef } from '../../contracts/authz.ts';
import { capabilityCatalog, moduleOfCapability, type ModuleCatalog } from './catalog.ts';
import type { RequestAuthorization } from './context.ts';
import {
  loadGrantedModules,
  loadMembershipRole,
  loadOverrides,
  loadPrincipal,
  loadRoleMatrix,
  type ContainerKind,
  type Principal,
  type RoleMatrix,
} from './loaders.ts';
import { applyContainerOverride, resolveOrgCell } from './policy.ts';

export interface AuthzDependencies {
  db: Database;
  modules: ModuleCatalog;
}

function userIdOf(actor: Actor): string {
  if (actor.kind === 'user') return actor.id;
  if (actor.userId) return actor.userId;
  throw new ForbiddenError('This actor does not act for a person');
}

function containerOf(resource: ResourceRef): { kind: ContainerKind; id: string } | null {
  if (!resource.id) return null;
  if (resource.kind === 'project') return { kind: 'project', id: resource.id };
  if (resource.kind === 'space') return { kind: 'space', id: resource.id };
  return null;
}

/**
 * The three layers of §4, in order: module access, container membership, then
 * capability. One instance per request; principals, module sets, role matrices
 * and resolved capability sets are cached for its lifetime.
 */
export function createRequestAuthorization(deps: AuthzDependencies): RequestAuthorization {
  const principals = new Map<string, Promise<Principal | null>>();
  const moduleSets = new Map<string, Promise<Set<string>>>();
  const matrices = new Map<string, Promise<RoleMatrix | null>>();
  const capabilitySets = new Map<string, Promise<Set<string>>>();
  const catalog = new Map(capabilityCatalog(deps.modules).map((entry) => [entry.name, entry]));

  const memo = <T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>) => {
    let value = cache.get(key);
    if (!value) {
      value = load();
      cache.set(key, value);
    }
    return value;
  };

  const principalOf = async (actor: Actor): Promise<Principal> => {
    const userId = userIdOf(actor);
    const principal = await memo(principals, userId, () => loadPrincipal(deps.db, userId));
    if (!principal) throw new ForbiddenError('This account is not active');
    return principal;
  };

  const modulesOf = (principal: Principal) =>
    memo(moduleSets, principal.userId, async () =>
      principal.isOrgAdmin
        ? new Set(deps.modules.ids())
        : loadGrantedModules(deps.db, principal, deps.modules.ids()),
    );

  const capabilitiesFor = (roleId: string, container: { kind: ContainerKind; id: string } | null) =>
    memo(capabilitySets, `${roleId}|${container?.kind ?? ''}|${container?.id ?? ''}`, async () => {
      const matrix = await memo(matrices, roleId, () => loadRoleMatrix(deps.db, roleId));
      if (!matrix) return new Set<string>();
      const overrides = container
        ? await loadOverrides(deps.db, container.kind, container.id, roleId)
        : new Map<string, boolean>();
      const granted = new Set<string>();
      for (const [name, entry] of catalog) {
        const org = resolveOrgCell(matrix.role, entry, matrix.cells.get(name));
        if (applyContainerOverride(org, overrides.get(name))) granted.add(name);
      }
      return granted;
    });

  const checkModule = async (principal: Principal, moduleId: string) => {
    if (!deps.modules.ids().includes(moduleId)) {
      throw new NotFoundError(`The ${moduleId} module is not enabled`, {
        code: 'module_not_enabled',
      });
    }
    if (!(await modulesOf(principal)).has(moduleId)) {
      throw new ForbiddenError(`You do not have access to the ${moduleId} module`, {
        code: 'module_access_denied',
        details: { moduleId },
      });
    }
  };

  const authorize = async (actor: Actor, capability: CapabilityName, resource: ResourceRef) => {
    if (actor.kind === 'system') return;
    const principal = await principalOf(actor);
    const moduleId = resource.moduleId ?? moduleOfCapability(capability);
    if (moduleId) await checkModule(principal, moduleId);
    if (principal.isOrgAdmin) return;
    const container = containerOf(resource);
    let roleId = principal.roleId;
    if (container) {
      const membership = await loadMembershipRole(
        deps.db,
        container.kind,
        container.id,
        principal.userId,
      );
      if (!membership) throw new ForbiddenError(`You are not a member of this ${container.kind}`);
      roleId = membership;
    }
    if (!(await capabilitiesFor(roleId, container)).has(capability)) {
      throw new ForbiddenError('You do not have permission to do this', {
        details: { capability },
      });
    }
  };

  return {
    authorize,
    async can(actor, capability, resource) {
      try {
        await authorize(actor, capability, resource);
        return true;
      } catch (error) {
        if (error instanceof ForbiddenError || error instanceof NotFoundError) return false;
        throw error;
      }
    },
    async modulesFor(actor) {
      if (actor.kind === 'system') return new Set(deps.modules.ids());
      return modulesOf(await principalOf(actor));
    },
    async canAccess(actor, moduleId) {
      return (await this.modulesFor(actor)).has(moduleId);
    },
    async workspaceCapabilities(actor) {
      const principal = await principalOf(actor);
      const granted = await capabilitiesFor(principal.roleId, null);
      const modules = await modulesOf(principal);
      return [...granted].filter((name) => {
        const moduleId = isKernelCapability(name) ? null : moduleOfCapability(name);
        return moduleId === null || modules.has(moduleId);
      });
    },
    async isOrgAdmin(actor) {
      if (actor.kind === 'system') return true;
      return (await principalOf(actor)).isOrgAdmin;
    },
  };
}
