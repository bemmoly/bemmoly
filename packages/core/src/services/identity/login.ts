import { UnauthenticatedError, type LoginRequest, type User } from '@bemmoly/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import { authIdentities, authProviders, users } from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import type { RequestContext } from '../authz/index.ts';
import { nowOf, type IdentityDependencies } from './deps.ts';
import { burnPasswordCheck, verifyPassword } from './passwords.ts';
import { loadUser } from './presenters.ts';
import {
  createSession,
  revokeSession,
  revokeUserSessions,
  type ClientInfo,
  type IssuedSession,
} from './sessions.ts';

const WRONG_CREDENTIALS = 'Email or password is incorrect';

/** The password identity of an account, found by email regardless of case. */
export async function findPasswordAccount(db: Database, email: string) {
  const [row] = await db
    .select({
      userId: users.id,
      status: users.status,
      name: users.name,
      email: users.email,
      privilegeVersion: users.privilegeVersion,
      identityId: authIdentities.id,
      passwordHash: authIdentities.passwordHash,
    })
    .from(users)
    .innerJoin(authIdentities, eq(authIdentities.userId, users.id))
    .innerJoin(
      authProviders,
      and(eq(authProviders.id, authIdentities.providerId), eq(authProviders.kind, 'password')),
    )
    .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
    .limit(1);
  return row ?? null;
}

/**
 * Checks the password and opens a session. Unknown email, wrong password and
 * an account without a password all answer the same, in the same time.
 */
export async function login(
  deps: Pick<IdentityDependencies, 'db' | 'now'>,
  input: LoginRequest,
  client: ClientInfo & { requestId?: string; previousSessionId?: string | undefined },
): Promise<{ user: User; session: IssuedSession }> {
  const account = await findPasswordAccount(deps.db, input.email);
  if (!account?.passwordHash) {
    await burnPasswordCheck(input.password);
    throw new UnauthenticatedError(WRONG_CREDENTIALS);
  }
  if (!(await verifyPassword(account.passwordHash, input.password))) {
    throw new UnauthenticatedError(WRONG_CREDENTIALS);
  }
  if (account.status !== 'active') {
    throw new UnauthenticatedError('This account has been deactivated');
  }
  const now = nowOf(deps);
  const session = await deps.db.transaction(async (tx) => {
    // A fresh session on every sign-in; the one this browser held is retired.
    if (client.previousSessionId) await revokeSession(tx, client.previousSessionId);
    const issued = await createSession(tx, {
      userId: account.userId,
      privilegeVersion: account.privilegeVersion,
      client,
      now,
    });
    await tx
      .update(authIdentities)
      .set({ lastUsedAt: now })
      .where(eq(authIdentities.id, account.identityId));
    await recordAudit(tx, {
      actor: { kind: 'user', id: account.userId },
      action: 'session.created',
      target: { kind: 'session', id: issued.sessionId },
      after: { method: 'password', userAgent: client.userAgent ?? null },
      meta: client,
    });
    return issued;
  });
  const user = await loadUser(deps.db, account.userId);
  if (!user) throw new UnauthenticatedError(WRONG_CREDENTIALS);
  return { user, session };
}

/** Ends this session, or with `everywhere` every session of the person. */
export async function logout(
  db: Database,
  ctx: RequestContext & { sessionId?: string },
  everywhere: boolean,
): Promise<void> {
  if (ctx.actor.kind !== 'user') {
    throw new UnauthenticatedError('Only a browser session can sign out');
  }
  const userId = ctx.actor.id;
  await db.transaction(async (tx) => {
    if (everywhere) {
      const count = await revokeUserSessions(tx, userId);
      await recordAudit(tx, {
        actor: ctx.actor,
        action: 'session.revoked_all',
        target: { kind: 'user', id: userId },
        after: { sessions: count },
        meta: ctx,
      });
    } else if (ctx.sessionId) {
      await revokeSession(tx, ctx.sessionId);
      await recordAudit(tx, {
        actor: ctx.actor,
        action: 'session.revoked',
        target: { kind: 'session', id: ctx.sessionId },
        meta: ctx,
      });
    }
  });
}
