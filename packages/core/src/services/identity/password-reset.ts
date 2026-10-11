import {
  ValidationError,
  type PasswordResetComplete,
  type PasswordResetPreviewResponse,
  type PasswordResetRequest,
  type User,
} from '@bemmoly/shared';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Actor } from '../../contracts/authz.ts';
import { authIdentities, passwordResetTokens, users } from '../../models/identity/index.ts';
import { recordAudit, type RequestMeta } from '../audit/index.ts';
import { appLink, nowOf, type IdentityDependencies } from './deps.ts';
import {
  PASSWORD_RESET_REQUESTED,
  PASSWORD_RESET_TTL_MS,
  passwordResetPath,
  type PasswordResetRequestedPayload,
} from './events.ts';
import { findPasswordAccount } from './login.ts';
import { hashPassword } from './passwords.ts';
import { generateToken, digestToken } from './tokens.ts';
import { loadUser } from './presenters.ts';
import {
  createSession,
  revokeUserSessions,
  type ClientInfo,
  type IssuedSession,
} from './sessions.ts';
import { inSharedTransaction } from './transaction.ts';

/** Anonymous requests are attributed to the system in the audit log. */
const ANONYMOUS: Actor = { kind: 'system', id: 'anonymous' };

/**
 * Always succeeds from the caller's view, so it cannot be used to discover
 * accounts. When an active password account exists, any earlier unused link is
 * retired and a new one goes out through `password_reset.requested`.
 */
export async function requestPasswordReset(
  deps: IdentityDependencies,
  input: PasswordResetRequest,
  meta: RequestMeta,
): Promise<void> {
  const account = await findPasswordAccount(deps.db, input.email);
  if (!account || account.status !== 'active') return;
  const now = nowOf(deps);
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);
  await inSharedTransaction(deps.sql, async (tx, executor) => {
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now, updatedAt: now })
      .where(
        and(eq(passwordResetTokens.userId, account.userId), isNull(passwordResetTokens.usedAt)),
      );
    const [row] = await tx
      .insert(passwordResetTokens)
      .values({
        userId: account.userId,
        tokenHash: digestToken(token),
        expiresAt,
        requestedIp: meta.ip ?? null,
      })
      .returning({ id: passwordResetTokens.id });
    await recordAudit(tx, {
      actor: ANONYMOUS,
      action: 'password_reset.requested',
      target: { kind: 'user', id: account.userId },
      after: { resetId: row?.id ?? null },
      meta,
    });
    if (!row) throw new Error('Password reset insert returned no row');
    const payload: PasswordResetRequestedPayload = {
      resetId: row.id,
      userId: account.userId,
      email: account.email,
      name: account.name,
      resetUrl: appLink(deps.publicUrl, passwordResetPath(token)),
      expiresAt,
    };
    await deps.events.publish({
      kind: PASSWORD_RESET_REQUESTED,
      occurredAt: now,
      entity: { kind: 'user', id: account.userId },
      payload,
      transaction: executor,
    });
  });
}

const INVALID_LINK = 'This reset link is invalid or has expired';

/**
 * Whose account a live reset link is for, so the page can say so; it does not spend the link.
 * A dead link answers as completing it would.
 */
export async function previewPasswordReset(
  deps: Pick<IdentityDependencies, 'db' | 'now'>,
  token: string,
): Promise<PasswordResetPreviewResponse> {
  const now = nowOf(deps);
  const [row] = await deps.db
    .select({ email: users.email, status: users.status })
    .from(passwordResetTokens)
    .innerJoin(users, eq(users.id, passwordResetTokens.userId))
    .where(
      and(
        eq(passwordResetTokens.tokenHash, digestToken(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
      ),
    )
    .limit(1);
  if (!row || row.status !== 'active') {
    throw new ValidationError(INVALID_LINK, { code: 'bad_request' });
  }
  return { email: row.email };
}

/**
 * Sets the new password, spends the link, signs the person out everywhere else and opens a
 * session here, so saving the password is also signing in.
 */
export async function completePasswordReset(
  deps: Pick<IdentityDependencies, 'db' | 'now'>,
  input: PasswordResetComplete,
  client: ClientInfo & RequestMeta,
): Promise<{ user: User; session: IssuedSession }> {
  const now = nowOf(deps);
  const passwordHash = await hashPassword(input.password);
  const meta = client;
  const { userId, session } = await deps.db.transaction(async (tx) => {
    const [spent] = await tx
      .update(passwordResetTokens)
      .set({ usedAt: now, updatedAt: now })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, digestToken(input.token)),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      )
      .returning({ userId: passwordResetTokens.userId });
    const [user] = spent
      ? await tx.select().from(users).where(eq(users.id, spent.userId)).limit(1)
      : [];
    if (!spent || !user || user.status !== 'active') {
      throw new ValidationError(INVALID_LINK, { code: 'bad_request' });
    }
    const account = await findPasswordAccount(tx, user.email);
    if (!account) throw new ValidationError('This account does not sign in with a password');
    await tx
      .update(authIdentities)
      .set({ passwordHash, updatedAt: now })
      .where(eq(authIdentities.id, account.identityId));
    await revokeUserSessions(tx, user.id);
    await recordAudit(tx, {
      actor: { kind: 'user', id: user.id },
      action: 'user.password_reset',
      target: { kind: 'user', id: user.id },
      meta,
    });
    const issued = await createSession(tx, {
      userId: user.id,
      privilegeVersion: user.privilegeVersion,
      client,
      now,
    });
    return { userId: user.id, session: issued };
  });
  const user = await loadUser(deps.db, userId);
  if (!user) throw new ValidationError(INVALID_LINK, { code: 'bad_request' });
  return { user, session };
}
