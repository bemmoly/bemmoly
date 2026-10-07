/*
 * Domain events identity publishes on the kernel EventBus, with the payloads
 * the email service validates (invitationCreatedPayloadSchema and
 * passwordResetRequestedPayloadSchema in the shared notifications schemas).
 * Each is published inside the transaction that made the change and passes it
 * as `DomainEvent.transaction`, so the outbox row is written atomically.
 * Only this service ever sees the plaintext token, so the links travel here.
 */

export const INVITATION_CREATED = 'invitation.created';

export interface InvitationCreatedPayload {
  invitationId: string;
  email: string;
  inviterName: string;
  /** `<BEMMOLY_PUBLIC_URL>/invitations/<token>` */
  acceptUrl: string;
  expiresAt: Date;
  /** Optional note from the inviter. */
  message?: string;
}

export const PASSWORD_RESET_REQUESTED = 'password_reset.requested';

export interface PasswordResetRequestedPayload {
  /** The password_reset_tokens row id: stable per request. */
  resetId: string;
  userId: string;
  email: string;
  name?: string;
  /** `<BEMMOLY_PUBLIC_URL>/password-reset/<token>` */
  resetUrl: string;
  expiresAt: Date;
}

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** Web routes the links open; the web app reads the token from the path. */
export const invitationPath = (token: string) => `invitations/${token}`;
export const passwordResetPath = (token: string) => `password-reset/${token}`;
