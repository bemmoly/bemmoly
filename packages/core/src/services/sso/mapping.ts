import { and, eq, inArray } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import type { Actor } from '../../contracts/authz.ts';
import { roles, teamMembers, users, type UserRow } from '../../models/identity/index.ts';
import { recordAudit, type RequestMeta } from '../audit/index.ts';
import { bumpPrivilegeVersion, countActiveOrgAdmins, ORG_ADMIN_ROLE_KEY } from '../authz/index.ts';
import type { LoadedProvider } from './config.ts';

/** The first role mapping, in the admin's order, whose group the person is in. */
export function mappedRoleId(provider: LoadedProvider, groups: readonly string[]): string | null {
  const member = new Set(groups);
  return provider.roleMappings.find((mapping) => member.has(mapping.group))?.roleId ?? null;
}

/** Teams named by a mapping: in when one of their groups matches, out when none does. */
export function mappedTeams(provider: LoadedProvider, groups: readonly string[]) {
  const member = new Set(groups);
  const wanted = new Set<string>();
  const managed = new Set<string>();
  for (const mapping of provider.teamMappings) {
    managed.add(mapping.teamId);
    if (member.has(mapping.group)) wanted.add(mapping.teamId);
  }
  return { wanted, managed };
}

async function roleKey(db: Database, roleId: string): Promise<string | null> {
  const [role] = await db.select({ key: roles.key }).from(roles).where(eq(roles.id, roleId));
  return role?.key ?? null;
}

interface SyncContext {
  meta: RequestMeta;
  /** A person created by this sign-in already has the mapped role. */
  isNew: boolean;
}

/**
 * Applies the provider's mappings on every sign-in. A matched role replaces the current one
 * (never demoting the last org admin); without a match the role is left alone, so an admin's
 * manual change survives. Only teams named by a mapping are touched.
 */
export async function syncMappings(
  db: Database,
  provider: LoadedProvider,
  user: UserRow,
  groups: readonly string[],
  context: SyncContext,
): Promise<void> {
  const system: Actor = { kind: 'system', id: `sso:${provider.row.id}` };
  let changed = false;
  const roleId = mappedRoleId(provider, groups);
  if (!context.isNew && roleId && roleId !== user.roleId) {
    const demotesLastAdmin =
      (await roleKey(db, user.roleId)) === ORG_ADMIN_ROLE_KEY &&
      (await countActiveOrgAdmins(db)) <= 1;
    if (!demotesLastAdmin) {
      await db.update(users).set({ roleId, updatedAt: new Date() }).where(eq(users.id, user.id));
      await recordAudit(db, {
        actor: system,
        action: 'user.role_changed',
        target: { kind: 'user', id: user.id },
        before: { roleId: user.roleId },
        after: { roleId, source: 'sso_group_mapping' },
        meta: context.meta,
      });
      changed = true;
    }
  }
  const { wanted, managed } = mappedTeams(provider, groups);
  if (managed.size > 0) {
    const current = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, user.id), inArray(teamMembers.teamId, [...managed])));
    const have = new Set(current.map((row) => row.teamId));
    const add = [...wanted].filter((teamId) => !have.has(teamId));
    const remove = [...have].filter((teamId) => !wanted.has(teamId));
    if (add.length > 0) {
      await db
        .insert(teamMembers)
        .values(add.map((teamId) => ({ teamId, userId: user.id })))
        .onConflictDoNothing();
    }
    if (remove.length > 0) {
      await db
        .delete(teamMembers)
        .where(and(eq(teamMembers.userId, user.id), inArray(teamMembers.teamId, remove)));
    }
    for (const teamId of add) {
      await recordAudit(db, {
        actor: system,
        action: 'team.member_added',
        target: { kind: 'team', id: teamId },
        after: { userId: user.id, source: 'sso_group_mapping' },
        meta: context.meta,
      });
    }
    for (const teamId of remove) {
      await recordAudit(db, {
        actor: system,
        action: 'team.member_removed',
        target: { kind: 'team', id: teamId },
        before: { userId: user.id, source: 'sso_group_mapping' },
        meta: context.meta,
      });
    }
    changed ||= add.length > 0 || remove.length > 0;
  }
  if (changed && !context.isNew) await bumpPrivilegeVersion(db, { userIds: [user.id] });
}
