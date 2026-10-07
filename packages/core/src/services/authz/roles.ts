import {
  ConflictError,
  NotFoundError,
  type CreateRoleInput,
  type Role,
  type UpdateRoleInput,
} from '@bemmoly/shared';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import {
  invitations,
  moduleGrants,
  roleCapabilities,
  roles,
  users,
  type RoleRow,
} from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import { capabilityCatalog, type ModuleCatalog } from './catalog.ts';
import type { RequestContext } from './context.ts';
import { loadRoleMatrix } from './loaders.ts';
import { resolveOrgCell } from './policy.ts';

const MANAGE = 'workspace.roles.manage' as const;

function presentRole(row: RoleRow, userCount: number): Role {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    isSystem: row.isSystem,
    userCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const userCount = sql<number>`(select count(*)::int from users u where u.role_id = ${roles.id})`;

/** Every authenticated person may list roles; the invite and People screens need them. */
export async function listRoles(db: Database): Promise<Role[]> {
  const rows = await db
    .select({ role: roles, userCount })
    .from(roles)
    .orderBy(desc(roles.isSystem), asc(roles.id));
  return rows.map((row) => presentRole(row.role, row.userCount));
}

export async function getRole(db: Database, roleId: string): Promise<Role> {
  const [row] = await db.select({ role: roles, userCount }).from(roles).where(eq(roles.id, roleId));
  if (!row) throw new NotFoundError('Role not found');
  return presentRole(row.role, row.userCount);
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return slug || 'role';
}

async function uniqueKey(db: Database, name: string): Promise<string> {
  const base = slugify(name);
  const taken = new Set(
    (
      await db
        .select({ key: roles.key })
        .from(roles)
        .where(sql`${roles.key} like ${`${base}%`}`)
    ).map((row) => row.key),
  );
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    if (!taken.has(`${base}_${suffix}`)) return `${base}_${suffix}`;
  }
}

export async function createRole(
  db: Database,
  modules: ModuleCatalog,
  ctx: RequestContext,
  input: CreateRoleInput,
): Promise<Role> {
  await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  const source = input.copyFromRoleId ? await loadRoleMatrix(db, input.copyFromRoleId) : null;
  if (input.copyFromRoleId && !source) throw new NotFoundError('The role to copy was not found');
  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(roles)
      .values({ key: await uniqueKey(tx, input.name), name: input.name, isSystem: false })
      .returning();
    if (!row) throw new Error('Role insert returned no row');
    if (source) {
      const cells = capabilityCatalog(modules).map((entry) => ({
        roleId: row.id,
        capability: entry.name,
        ...resolveOrgCell(source.role, entry, source.cells.get(entry.name)),
      }));
      if (cells.length > 0) await tx.insert(roleCapabilities).values(cells);
    }
    const role = presentRole(row, 0);
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'role.created',
      target: { kind: 'role', id: row.id },
      after: { ...role, copiedFrom: input.copyFromRoleId ?? null },
      meta: ctx,
    });
    return role;
  });
  return created;
}

export async function updateRole(
  db: Database,
  ctx: RequestContext,
  roleId: string,
  input: UpdateRoleInput,
): Promise<Role> {
  await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  const before = await getRole(db, roleId);
  if (before.isSystem) throw new ConflictError('System roles cannot be renamed');
  await db.transaction(async (tx) => {
    await tx
      .update(roles)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(roles.id, roleId));
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'role.updated',
      target: { kind: 'role', id: roleId },
      before: { name: before.name },
      after: { name: input.name },
      meta: ctx,
    });
  });
  return getRole(db, roleId);
}

export async function deleteRole(db: Database, ctx: RequestContext, roleId: string) {
  await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  const before = await getRole(db, roleId);
  if (before.isSystem) throw new ConflictError('System roles cannot be deleted');
  const [pending] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(and(eq(invitations.roleId, roleId), sql`${invitations.acceptedAt} is null`))
    .limit(1);
  const [holder] = await db.select({ id: users.id }).from(users).where(eq(users.roleId, roleId));
  if (holder || pending) {
    throw new ConflictError('Move everyone off this role, and revoke its invitations, first');
  }
  await db.transaction(async (tx) => {
    await tx
      .delete(moduleGrants)
      .where(and(eq(moduleGrants.subjectKind, 'role'), eq(moduleGrants.subjectId, roleId)));
    await tx.delete(roles).where(eq(roles.id, roleId));
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'role.deleted',
      target: { kind: 'role', id: roleId },
      before,
      meta: ctx,
    });
  });
}
