import { z } from 'zod';
import { notificationKindSchema } from './kinds.ts';

/**
 * Payloads of the domain events the notification service consumes. Publishers
 * build them with these schemas; the service validates them again on receipt.
 */
export const NOTIFICATION_EVENT_KINDS = {
  invitationCreated: 'invitation.created',
  passwordResetRequested: 'password_reset.requested',
  notificationRequested: 'notification.requested',
} as const;

/** `invitation.created`: one email to the invited address. */
export const invitationCreatedPayloadSchema = z.object({
  invitationId: z.string().min(1),
  email: z.email(),
  inviterName: z.string().min(1).max(200),
  /** Absolute link to the accept page, token included. */
  acceptUrl: z.url({ protocol: /^https?$/ }),
  expiresAt: z.coerce.date(),
  /** Optional note from the inviter, shown as a quote. */
  message: z.string().max(1000).optional(),
});

/** `password_reset.requested`: one email to the account's address. */
export const passwordResetRequestedPayloadSchema = z.object({
  /** Stable per request so a retried publish never sends twice. */
  resetId: z.string().min(1),
  userId: z.uuid(),
  email: z.email(),
  name: z.string().max(200).optional(),
  resetUrl: z.url({ protocol: /^https?$/ }),
  expiresAt: z.coerce.date(),
});

export const notificationTargetInputSchema = z.object({
  kind: z.string().min(1).max(64),
  id: z.string().min(1).max(200),
  /** Short label such as an issue key or page title: "PLT-204". */
  label: z.string().max(200).optional(),
  /** Absolute or app-relative link; relative links are resolved against the public URL. */
  url: z.string().max(2000).optional(),
});

/**
 * `notification.requested`: the generic event other modules publish. One inbox
 * row per recipient (the actor is never notified of their own action), then
 * email per each recipient's preference for the kind.
 */
export const notificationRequestedPayloadSchema = z.object({
  kind: notificationKindSchema,
  recipientIds: z.array(z.uuid()).min(1).max(1000),
  actorId: z.uuid().optional(),
  actorName: z.string().max(200).optional(),
  target: notificationTargetInputSchema,
  body: z.string().max(2000).default(''),
  /** Overrides the default reason line, e.g. "you watch PLT-204". */
  reason: z.string().max(200).optional(),
  /** Stable per logical notification so a retried publish never duplicates rows. */
  dedupeKey: z.string().max(200).optional(),
  /** Kind-specific fields for templates, e.g. `{ version }` for update_available. */
  data: z.record(z.string(), z.unknown()).optional(),
});

export type InvitationCreatedPayload = z.infer<typeof invitationCreatedPayloadSchema>;
export type PasswordResetRequestedPayload = z.infer<typeof passwordResetRequestedPayloadSchema>;
export type NotificationTargetInput = z.infer<typeof notificationTargetInputSchema>;
export type NotificationRequestedPayload = z.input<typeof notificationRequestedPayloadSchema>;
export type NotificationRequest = z.output<typeof notificationRequestedPayloadSchema>;
