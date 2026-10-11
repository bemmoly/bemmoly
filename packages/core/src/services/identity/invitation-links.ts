import { NotFoundError, type IssuedInvitation } from '@bemmoly/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { invitations } from '../../models/identity/index.ts';
import { recordAudit } from '../audit/index.ts';
import type { RequestContext } from '../authz/index.ts';
import { appLink, nowOf, type IdentityDependencies } from './deps.ts';
import { INVITATION_TTL_MS, invitationPath } from './events.ts';
import { presentInvitation } from './presenters.ts';
import { generateToken, digestToken } from './tokens.ts';

const MANAGE = 'workspace.roles.manage' as const;

/**
 * A new accept link for a pending invitation, for the admin to copy and share
 * by hand. Only the token's hash is stored, so the old link cannot be shown
 * again: the token rotates (the old link stops working) and the expiry starts
 * over. No email is sent; resend is the path that emails.
 */
export async function issueInvitationLink(
  deps: Pick<IdentityDependencies, 'db' | 'publicUrl' | 'now'>,
  ctx: RequestContext,
  id: string,
): Promise<IssuedInvitation> {
  await ctx.authz.authorize(ctx.actor, MANAGE, { kind: 'workspace' });
  const now = nowOf(deps);
  const token = generateToken();
  const row = await deps.db.transaction(async (tx) => {
    const [updated] = await tx
      .update(invitations)
      .set({
        tokenHash: digestToken(token),
        expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
        updatedAt: now,
      })
      .where(
        and(eq(invitations.id, id), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)),
      )
      .returning();
    if (!updated) throw new NotFoundError('Invitation not found');
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'invitation.link_issued',
      target: { kind: 'invitation', id },
      after: presentInvitation(updated),
      meta: ctx,
    });
    return updated;
  });
  return { ...presentInvitation(row), acceptUrl: appLink(deps.publicUrl, invitationPath(token)) };
}
