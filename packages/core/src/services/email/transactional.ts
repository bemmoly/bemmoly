import {
  invitationCreatedPayloadSchema,
  parseOrThrow,
  passwordResetRequestedPayloadSchema,
} from '@bemmoly/shared';
import type { SqlExecutor } from '../../contracts/sql.ts';
import { frameEmail, type EmailContext } from './context.ts';
import { queueEmail } from './outbox/queue.ts';
import { invitationEmail, passwordResetEmail, renderEmail } from './templates/index.ts';

/**
 * Invitations and password resets answer one request from one person, so they
 * carry a reason line but no unsubscribe link: there is no stream to leave.
 */
export async function queueInvitationEmail(
  ctx: EmailContext,
  db: SqlExecutor,
  input: unknown,
): Promise<string> {
  const invitation = parseOrThrow(invitationCreatedPayloadSchema, input);
  const { frame, headers } = await frameEmail(
    ctx,
    (brand) =>
      `You're receiving this because ${invitation.inviterName} invited this address to ${brand.workspaceName}.`,
    null,
  );
  const email = await renderEmail(frame, invitationEmail(frame, invitation));
  return queueEmail(ctx.jobs, db, {
    kind: 'invitation',
    toAddress: invitation.email,
    toName: null,
    ...email,
    headers,
    dedupeKey: `invitation:${invitation.invitationId}:${invitation.expiresAt.toISOString()}`,
  });
}

export async function queuePasswordResetEmail(
  ctx: EmailContext,
  db: SqlExecutor,
  input: unknown,
): Promise<string> {
  const reset = parseOrThrow(passwordResetRequestedPayloadSchema, input);
  const { frame, headers } = await frameEmail(
    ctx,
    "You're receiving this because someone asked to reset the password for this address.",
    null,
  );
  const email = await renderEmail(frame, passwordResetEmail(frame, reset));
  return queueEmail(ctx.jobs, db, {
    kind: 'password_reset',
    toAddress: reset.email,
    toName: reset.name ?? null,
    ...email,
    headers,
    dedupeKey: `password_reset:${reset.resetId}`,
  });
}
