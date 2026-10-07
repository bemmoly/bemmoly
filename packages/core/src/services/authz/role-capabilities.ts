import {
  NotFoundError,
  ValidationError,
  type CapabilityMatrix,
  type PutRoleCapabilitiesInput,
  type RoleCapabilitiesResponse,
} from '@bemmoly/shared';
import type { Database } from '../../clients/drizzle.ts';
import { roleCapabilities } from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import { capabilityCatalog, type CatalogEntry, type ModuleCatalog } from './catalog.ts';
import type { RequestContext } from './context.ts';
import { loadRoleMatrix, type RoleMatrix } from './loaders.ts';
import { checkMatrixEdit, resolveOrgCell, type MatrixCell } from './policy.ts';
import { bumpPrivilegeVersion } from './privileges.ts';
import { listRoles } from './roles.ts';

const MANAGE = 'workspace.roles.manage' as const;

function cellsOf(matrix: RoleMatrix, catalog: readonly CatalogEntry[]) {
  return catalog.map((entry) => ({
    capability: entry.name,
    label: entry.label,
    description: entry.description,
    group: entry.group,
    moduleId: entry.moduleId,
    ...resolveOrgCell(matrix.role, entry, matrix.cells.get(entry.name)),
  }));
}

export async function getRoleCapabilities(
  db: Database,
  modules: ModuleCatalog,
  ctx: RequestContext,
  roleId: string,
): Promise<RoleCapabilitiesResponse> {
  await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  const matrix = await loadRoleMatrix(db, roleId);
  if (!matrix) throw new NotFoundError('Role not found');
  return { roleId, items: cellsOf(matrix, capabilityCatalog(modules)) };
}

/**
 * Upserts the listed cells. Locked rows, and the lock itself, change only for
 * org admins; the Org admin column cannot lose a capability. Everyone holding
 * the role gets their session rotated on the next request.
 */
export async function putRoleCapabilities(
  db: Database,
  modules: ModuleCatalog,
  ctx: RequestContext,
  roleId: string,
  input: PutRoleCapabilitiesInput,
): Promise<RoleCapabilitiesResponse> {
  await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  const editorIsOrgAdmin = await ctx.authz.isOrgAdmin(ctx.actor);
  const catalog = new Map(capabilityCatalog(modules).map((entry) => [entry.name, entry]));
  await db.transaction(async (tx) => {
    const matrix = await loadRoleMatrix(tx, roleId);
    if (!matrix) throw new NotFoundError('Role not found');
    const before: Record<string, MatrixCell> = {};
    const after: Record<string, MatrixCell> = {};
    for (const item of input.items) {
      const entry = catalog.get(item.capability);
      if (!entry) {
        throw new ValidationError(`Unknown capability "${item.capability}"`, {
          details: { capability: item.capability },
        });
      }
      const current = resolveOrgCell(matrix.role, entry, matrix.cells.get(entry.name));
      const next = checkMatrixEdit({ editorIsOrgAdmin, role: matrix.role, current, next: item });
      if (next.allowed === current.allowed && next.lockedByOrg === current.lockedByOrg) continue;
      before[entry.name] = current;
      after[entry.name] = next;
      await tx
        .insert(roleCapabilities)
        .values({ roleId, capability: entry.name, ...next })
        .onConflictDoUpdate({
          target: [roleCapabilities.roleId, roleCapabilities.capability],
          set: { ...next, updatedAt: new Date() },
        });
    }
    if (Object.keys(after).length === 0) return;
    await bumpPrivilegeVersion(tx, { roleId });
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'role.capabilities_changed',
      target: { kind: 'role', id: roleId },
      before,
      after,
      meta: ctx,
    });
  });
  return getRoleCapabilities(db, modules, ctx, roleId);
}

/** The whole matrix in one response, for the Roles and permissions screen. */
export async function getCapabilityMatrix(
  db: Database,
  modules: ModuleCatalog,
  ctx: RequestContext,
): Promise<CapabilityMatrix> {
  await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  const roles = await listRoles(db);
  const catalog = capabilityCatalog(modules);
  const matrices = await Promise.all(roles.map((role) => loadRoleMatrix(db, role.id)));
  return {
    roles,
    items: catalog.map((entry) => ({
      name: entry.name,
      label: entry.label,
      description: entry.description,
      group: entry.group,
      moduleId: entry.moduleId,
      cells: Object.fromEntries(
        matrices
          .filter((matrix): matrix is RoleMatrix => matrix !== null)
          .map((matrix) => [
            matrix.role.id,
            resolveOrgCell(matrix.role, entry, matrix.cells.get(entry.name)),
          ]),
      ),
    })),
  };
}
