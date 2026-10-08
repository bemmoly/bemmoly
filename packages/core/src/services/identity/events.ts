/*
 * Domain events identity publishes on the kernel EventBus, with the payloads
 * the email service validates (invitationCreatedPayloadSchema and
 * passwordResetRequestedPayloadSchema in the shared notifications schemas).
 * Each is published inside the transaction that made the change and passes it
 * as `DomainEvent.transaction`, so the outbox row is written atomically.
 * Only this service ever sees the plaintext token, so the links travel here.
 */

import {
  ACCEPT_INVITATION_PATH,
  NOTIFICATION_EVENT_KINDS,
  RESET_PASSWORD_PATH,
  tokenLinkPath,
} from '@bemmoly/shared';

export type { InvitationCreatedPayload, PasswordResetRequestedPayload } from '@bemmoly/shared';

/** acceptUrl is `<BEMMOLY_PUBLIC_URL>/accept-invitation#token=<token>`. */
export const INVITATION_CREATED = NOTIFICATION_EVENT_KINDS.invitationCreated;

/**
 * resetId is the password_reset_tokens row id; resetUrl is
 * `<BEMMOLY_PUBLIC_URL>/reset-password#token=<token>`.
 */
export const PASSWORD_RESET_REQUESTED = NOTIFICATION_EVENT_KINDS.passwordResetRequested;

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/**
 * Web routes the links open. The web app reads the token from the fragment, and its router
 * registers the same paths from packages/shared.
 */
export const invitationPath = (token: string) => tokenLinkPath(ACCEPT_INVITATION_PATH, token);
export const passwordResetPath = (token: string) => tokenLinkPath(RESET_PASSWORD_PATH, token);
