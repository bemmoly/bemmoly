/*
 * Domain events identity publishes on the kernel EventBus. Email delivery
 * subscribes to them; nothing here sends mail. Payloads carry the one-time
 * link because only this service ever sees the plaintext token.
 */

export const INVITATION_CREATED = 'invitation.created';

export interface InvitationCreatedPayload {
  invitationId: string;
  email: string;
  roleId: string;
  roleName: string;
  teamId: string | null;
  teamName: string | null;
  invitedBy: { id: string; name: string; email: string } | null;
  workspaceName: string;
  /** One-time link; the token sits in the fragment so it never reaches access logs. */
  acceptUrl: string;
  expiresAt: string;
}

export const PASSWORD_RESET_REQUESTED = 'password_reset.requested';

export interface PasswordResetRequestedPayload {
  userId: string;
  email: string;
  name: string;
  /** One-time link with the token in the fragment. */
  resetUrl: string;
  expiresAt: string;
}

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
