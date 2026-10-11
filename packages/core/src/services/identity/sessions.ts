import { and, desc, eq, gt, lte, ne, or } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import { sessions, users, type SessionRow } from '../../models/identity/index.ts';
import { digestsEqual, generateToken, digestToken } from './tokens.ts';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Sliding expiry is written at most this often per session, to keep reads cheap. */
export const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
/** After a rotation the old token still works this long, for requests already in flight. */
export const ROTATION_GRACE_MS = 60 * 1000;

export interface ClientInfo {
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export interface IssuedSession {
  token: string;
  sessionId: string;
  expiresAt: Date;
}

const clip = (value: string | undefined, max: number) => (value ? value.slice(0, max) : null);

export async function createSession(
  db: Database,
  input: { userId: string; privilegeVersion: number; client: ClientInfo; now: Date },
): Promise<IssuedSession> {
  const token = generateToken();
  const expiresAt = new Date(input.now.getTime() + SESSION_TTL_MS);
  const [row] = await db
    .insert(sessions)
    .values({
      userId: input.userId,
      tokenHash: digestToken(token),
      expiresAt,
      lastSeenAt: input.now,
      ip: clip(input.client.ip, 64),
      userAgent: clip(input.client.userAgent, 512),
      privilegeVersion: input.privilegeVersion,
    })
    .returning({ id: sessions.id });
  if (!row) throw new Error('Session insert returned no row');
  await db.update(users).set({ lastSeenAt: input.now }).where(eq(users.id, input.userId));
  return { token, sessionId: row.id, expiresAt };
}

export interface AuthenticatedSession {
  sessionId: string;
  userId: string;
  expiresAt: Date;
  /** Set when the cookie must be re-sent: a rotated token, or a slid expiry. */
  reissue?: { token: string | null; expiresAt: Date };
}

/**
 * Resolves a cookie token. Null for unknown, expired, or deactivated people.
 * Rotates the token when the person's privileges changed since it was issued,
 * and slides the 30-day expiry forward on use.
 */
export async function authenticateSession(
  db: Database,
  token: string,
  client: ClientInfo,
  now: Date,
  options: { readOnly?: boolean } = {},
): Promise<AuthenticatedSession | null> {
  const digest = digestToken(token);
  const graceStart = new Date(now.getTime() - ROTATION_GRACE_MS);
  const [row] = await db
    .select({ session: sessions, status: users.status, privilegeVersion: users.privilegeVersion })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      or(
        eq(sessions.tokenHash, digest),
        and(eq(sessions.previousTokenHash, digest), gt(sessions.rotatedAt, graceStart)),
      ),
    )
    .limit(1);
  if (!row) return null;
  const { session } = row;
  if (session.expiresAt <= now) {
    if (!options.readOnly) await db.delete(sessions).where(eq(sessions.id, session.id));
    return null;
  }
  if (row.status !== 'active') return null;
  const base = { sessionId: session.id, userId: session.userId, expiresAt: session.expiresAt };
  if (options.readOnly || !digestsEqual(session.tokenHash, digest)) return base;
  if (session.privilegeVersion !== row.privilegeVersion) {
    return { ...base, ...(await rotate(db, session, row.privilegeVersion, client, now)) };
  }
  if (now.getTime() - session.lastSeenAt.getTime() < SESSION_TOUCH_INTERVAL_MS) return base;
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db
    .update(sessions)
    .set({ lastSeenAt: now, expiresAt, ...clientColumns(client), updatedAt: now })
    .where(eq(sessions.id, session.id));
  await db.update(users).set({ lastSeenAt: now }).where(eq(users.id, session.userId));
  return { ...base, expiresAt, reissue: { token: null, expiresAt } };
}

function clientColumns(client: ClientInfo) {
  return { ip: clip(client.ip, 64), userAgent: clip(client.userAgent, 512) };
}

async function rotate(
  db: Database,
  session: SessionRow,
  privilegeVersion: number,
  client: ClientInfo,
  now: Date,
): Promise<Pick<AuthenticatedSession, 'expiresAt' | 'reissue'>> {
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db
    .update(sessions)
    .set({
      tokenHash: digestToken(token),
      previousTokenHash: session.tokenHash,
      rotatedAt: now,
      privilegeVersion,
      expiresAt,
      lastSeenAt: now,
      ...clientColumns(client),
      updatedAt: now,
    })
    .where(eq(sessions.id, session.id));
  return { expiresAt, reissue: { token, expiresAt } };
}

/** Issues a fresh token for an existing session, e.g. right after a privilege change. */
export async function rotateSession(
  db: Database,
  sessionId: string,
  client: ClientInfo,
  now: Date,
): Promise<IssuedSession | null> {
  const [row] = await db
    .select({ session: sessions, privilegeVersion: users.privilegeVersion })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId));
  if (!row) return null;
  const rotated = await rotate(db, row.session, row.privilegeVersion, client, now);
  const token = rotated.reissue?.token;
  return token ? { token, sessionId, expiresAt: rotated.expiresAt } : null;
}

export async function revokeSession(db: Database, sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/** Logout everywhere: every session of the person, optionally keeping one. */
export async function revokeUserSessions(
  db: Database,
  userId: string,
  exceptSessionId?: string,
): Promise<number> {
  const deleted = await db
    .delete(sessions)
    .where(
      exceptSessionId
        ? and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId))
        : eq(sessions.userId, userId),
    )
    .returning({ id: sessions.id });
  return deleted.length;
}

export async function listUserSessions(db: Database, userId: string, now: Date) {
  return db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)))
    .orderBy(desc(sessions.lastSeenAt));
}

/** Housekeeping: drops sessions past their expiry. */
export async function deleteExpiredSessions(db: Database, now: Date): Promise<number> {
  const deleted = await db
    .delete(sessions)
    .where(lte(sessions.expiresAt, now))
    .returning({ id: sessions.id });
  return deleted.length;
}
