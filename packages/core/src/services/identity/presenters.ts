import type { ApiToken, Invitation, Session, User } from '@bemmoly/shared';
import { eq, inArray } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import {
  teamMembers,
  users,
  type ApiTokenRow,
  type InvitationRow,
  type SessionRow,
  type UserRow,
} from '../../models/identity/index.ts';

const iso = (value: Date | null) => (value ? value.toISOString() : null);

export function presentUser(row: UserRow, teamIds: readonly string[]): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarKey: row.avatarKey,
    status: row.status,
    isBreakGlass: row.isBreakGlass,
    roleId: row.roleId,
    teamIds: [...teamIds],
    themePref: row.themePref,
    locale: row.locale,
    timezone: row.timezone,
    lastSeenAt: iso(row.lastSeenAt),
    createdAt: row.createdAt.toISOString(),
  };
}

/** Presents many users with their team ids in two queries. */
export async function presentUsers(db: Database, rows: readonly UserRow[]): Promise<User[]> {
  if (rows.length === 0) return [];
  const memberships = await db
    .select({ userId: teamMembers.userId, teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(
      inArray(
        teamMembers.userId,
        rows.map((row) => row.id),
      ),
    );
  const byUser = new Map<string, string[]>();
  for (const { userId, teamId } of memberships) {
    byUser.set(userId, [...(byUser.get(userId) ?? []), teamId]);
  }
  return rows.map((row) => presentUser(row, byUser.get(row.id) ?? []));
}

export async function loadUser(db: Database, userId: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) return null;
  const [user] = await presentUsers(db, [row]);
  return user ?? null;
}

export function presentSession(row: SessionRow, currentSessionId?: string): Session {
  return {
    id: row.id,
    ip: row.ip,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    current: row.id === currentSessionId,
  };
}

export function presentApiToken(row: ApiTokenRow): ApiToken {
  return {
    id: row.id,
    name: row.name,
    prefix: row.tokenPrefix,
    scopes: row.scopes.filter((scope): scope is ApiToken['scopes'][number] =>
      ['read', 'write'].includes(scope),
    ),
    lastUsedAt: iso(row.lastUsedAt),
    expiresAt: iso(row.expiresAt),
    createdAt: row.createdAt.toISOString(),
  };
}

export function presentInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    email: row.email,
    roleId: row.roleId,
    teamId: row.teamId,
    invitedBy: row.invitedBy,
    expiresAt: row.expiresAt.toISOString(),
    acceptedAt: iso(row.acceptedAt),
    revokedAt: iso(row.revokedAt),
    createdAt: row.createdAt.toISOString(),
  };
}
