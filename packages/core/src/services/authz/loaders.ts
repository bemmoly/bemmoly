import { and, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import {
  moduleGrants,
  projectMembers,
  projectRoleCapabilities,
  roleCapabilities,
  roles,
  spaceMembers,
  spaceRoleCapabilities,
  teamMembers,
  users,
} from '../../models/identity/index.ts';
import { ORG_ADMIN_ROLE_KEY, type MatrixCell, type RoleIdentity } from './policy.ts';

/** The person behind an actor, as authorization sees them. */
export interface Principal {
  userId: string;
  roleId: string;
  roleKey: string;
  isOrgAdmin: boolean;
  teamIds: string[];
}

/** Null when the person does not exist or is not active. */
export async function loadPrincipal(db: Database, userId: string): Promise<Principal | null> {
  const [row] = await db
    .select({ roleId: users.roleId, status: users.status, roleKey: roles.key })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row || row.status !== 'active') return null;
  const teams = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));
  return {
    userId,
    roleId: row.roleId,
    roleKey: row.roleKey,
    isOrgAdmin: row.roleKey === ORG_ADMIN_ROLE_KEY,
    teamIds: teams.map((team) => team.teamId),
  };
}

export interface RoleMatrix {
  role: RoleIdentity & { id: string };
  cells: Map<string, MatrixCell>;
}

export async function loadRoleMatrix(db: Database, roleId: string): Promise<RoleMatrix | null> {
  const [role] = await db
    .select({ id: roles.id, key: roles.key, isSystem: roles.isSystem })
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1);
  if (!role) return null;
  const rows = await db
    .select({
      capability: roleCapabilities.capability,
      allowed: roleCapabilities.allowed,
      lockedByOrg: roleCapabilities.lockedByOrg,
    })
    .from(roleCapabilities)
    .where(eq(roleCapabilities.roleId, roleId));
  return {
    role,
    cells: new Map(rows.map((row) => [row.capability, row])),
  };
}

export type ContainerKind = 'project' | 'space';

const CONTAINERS = {
  project: {
    members: projectMembers,
    memberKey: projectMembers.projectId,
    overrides: projectRoleCapabilities,
    overrideKey: projectRoleCapabilities.projectId,
  },
  space: {
    members: spaceMembers,
    memberKey: spaceMembers.spaceId,
    overrides: spaceRoleCapabilities,
    overrideKey: spaceRoleCapabilities.spaceId,
  },
} as const;

/** The role a person holds inside a project or space, or null when not a member. */
export async function loadMembershipRole(
  db: Database,
  kind: ContainerKind,
  containerId: string,
  userId: string,
): Promise<string | null> {
  const table = CONTAINERS[kind];
  const [row] = await db
    .select({ roleId: table.members.roleId })
    .from(table.members)
    .where(and(eq(table.memberKey, containerId), eq(table.members.userId, userId)))
    .limit(1);
  return row?.roleId ?? null;
}

export async function loadOverrides(
  db: Database,
  kind: ContainerKind,
  containerId: string,
  roleId: string,
): Promise<Map<string, boolean>> {
  const table = CONTAINERS[kind];
  const rows = await db
    .select({ capability: table.overrides.capability, allowed: table.overrides.allowed })
    .from(table.overrides)
    .where(and(eq(table.overrideKey, containerId), eq(table.overrides.roleId, roleId)));
  return new Map(rows.map((row) => [row.capability, row.allowed]));
}

/** Enabled modules this person holds a grant for, through everyone, a team, the role or directly. */
export async function loadGrantedModules(
  db: Database,
  principal: Principal,
  enabled: readonly string[],
): Promise<Set<string>> {
  if (enabled.length === 0) return new Set();
  const subjects: SQL[] = [
    eq(moduleGrants.subjectKind, 'everyone'),
    and(eq(moduleGrants.subjectKind, 'user'), eq(moduleGrants.subjectId, principal.userId))!,
    and(eq(moduleGrants.subjectKind, 'role'), eq(moduleGrants.subjectId, principal.roleId))!,
  ];
  if (principal.teamIds.length > 0) {
    subjects.push(
      and(
        eq(moduleGrants.subjectKind, 'team'),
        inArray(moduleGrants.subjectId, principal.teamIds),
      )!,
    );
  }
  const rows = await db
    .selectDistinct({ moduleId: moduleGrants.moduleId })
    .from(moduleGrants)
    .where(and(inArray(moduleGrants.moduleId, [...enabled]), or(...subjects)));
  return new Set(rows.map((row) => row.moduleId));
}

/** Count of active org admins, used to refuse removing the last one. */
export async function countActiveOrgAdmins(db: Database): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(and(eq(roles.key, ORG_ADMIN_ROLE_KEY), eq(users.status, 'active')));
  return row?.count ?? 0;
}
