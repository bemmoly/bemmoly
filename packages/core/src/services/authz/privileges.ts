import { eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import { teamMembers, users } from '../../models/identity/index.ts';

export type PrivilegeScope =
  { userIds: readonly string[] } | { roleId: string } | { teamId: string };

/**
 * Marks a privilege change for the people in scope. Their next request with an
 * older session rotates the session token (the session layer compares versions).
 */
export async function bumpPrivilegeVersion(db: Database, scope: PrivilegeScope): Promise<void> {
  const set = { privilegeVersion: sql`${users.privilegeVersion} + 1`, updatedAt: new Date() };
  if ('userIds' in scope) {
    if (scope.userIds.length === 0) return;
    await db
      .update(users)
      .set(set)
      .where(inArray(users.id, [...scope.userIds]));
  } else if ('roleId' in scope) {
    await db.update(users).set(set).where(eq(users.roleId, scope.roleId));
  } else {
    const members = db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, scope.teamId));
    await db.update(users).set(set).where(inArray(users.id, members));
  }
}
