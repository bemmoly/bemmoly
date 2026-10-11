import { and, eq, inArray } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import {
  moduleGrants,
  projectMembers,
  roles,
  spaceMembers,
  teamMembers,
  users,
} from '../../models/identity/index.ts';
import type { ContainerKind, Principal } from './loaders.ts';
import { ORG_ADMIN_ROLE_KEY } from './policy.ts';

/*
 * The set-based side of authorization: who among many people passes one check. Fan-out
 * (notifications, mentions) asks this once per event, in a fixed handful of queries, rather
 * than resolving every recipient on their own.
 */

/** Active people among `userIds`, with their org role and teams. */
export async function loadPrincipals(
  db: Database,
  userIds: readonly string[],
): Promise<Principal[]> {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({ userId: users.id, roleId: users.roleId, roleKey: roles.key })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(and(inArray(users.id, [...userIds]), eq(users.status, 'active')));
  if (rows.length === 0) return [];
  const teams = await db
    .select({ userId: teamMembers.userId, teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(
      inArray(
        teamMembers.userId,
        rows.map((row) => row.userId),
      ),
    );
  return rows.map((row) => ({
    userId: row.userId,
    roleId: row.roleId,
    roleKey: row.roleKey,
    isOrgAdmin: row.roleKey === ORG_ADMIN_ROLE_KEY,
    teamIds: teams.filter((team) => team.userId === row.userId).map((team) => team.teamId),
  }));
}

/** Whether each person holds a grant for the module, through everyone, a team, the role or directly. */
export async function loadModuleHolders(
  db: Database,
  moduleId: string,
  principals: readonly Principal[],
): Promise<Set<string>> {
  const grants = await db
    .select({ kind: moduleGrants.subjectKind, id: moduleGrants.subjectId })
    .from(moduleGrants)
    .where(eq(moduleGrants.moduleId, moduleId));
  const everyone = grants.some((grant) => grant.kind === 'everyone');
  const granted = (kind: string) =>
    new Set(grants.filter((grant) => grant.kind === kind).map((grant) => grant.id));
  const byUser = granted('user');
  const byRole = granted('role');
  const byTeam = granted('team');
  return new Set(
    principals
      .filter(
        (principal) =>
          principal.isOrgAdmin ||
          everyone ||
          byUser.has(principal.userId) ||
          byRole.has(principal.roleId) ||
          principal.teamIds.some((teamId) => byTeam.has(teamId)),
      )
      .map((principal) => principal.userId),
  );
}

/** The role each of `userIds` holds inside the project or space; non-members are absent. */
export async function loadMembershipRoles(
  db: Database,
  kind: ContainerKind,
  containerId: string,
  userIds: readonly string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const table = kind === 'project' ? projectMembers : spaceMembers;
  const key = kind === 'project' ? projectMembers.projectId : spaceMembers.spaceId;
  const rows = await db
    .select({ userId: table.userId, roleId: table.roleId })
    .from(table)
    .where(and(eq(key, containerId), inArray(table.userId, [...userIds])));
  return new Map(rows.map((row) => [row.userId, row.roleId]));
}
