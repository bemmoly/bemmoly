import { z } from 'zod';

/**
 * Kernel notification kinds. Modules may publish their own kinds namespaced by
 * module id (`work.sprint_started`); unknown kinds default to the digest.
 */
export const KERNEL_NOTIFICATION_KINDS = [
  'mention',
  'assignment',
  'review_request',
  'comment',
  'status_change',
  'watch_update',
  'backup_failed',
  'update_available',
] as const;

export type KernelNotificationKind = (typeof KERNEL_NOTIFICATION_KINDS)[number];

const KIND_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)?$/;

export const notificationKindSchema = z
  .string()
  .max(64)
  .regex(KIND_PATTERN, 'Kinds look like "comment" or "<module>.<kind>"');

/**
 * Per user per kind. Every channel except `off` shows the notification in the
 * in-app inbox; the email channels add an email, sent at once or in the digest.
 */
export const NOTIFICATION_CHANNELS = ['inapp', 'email_immediate', 'email_digest', 'off'] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const notificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);

/** Mentions, assignments, review requests and failures go at once; the rest is batched. */
export const IMMEDIATE_KINDS: readonly string[] = [
  'mention',
  'assignment',
  'review_request',
  'backup_failed',
];

export function defaultChannelFor(kind: string): NotificationChannel {
  return IMMEDIATE_KINDS.includes(kind) ? 'email_immediate' : 'email_digest';
}

/** `interval` batches every `email.digestMinutes`; `daily` sends one summary at the chosen hour. */
export const DIGEST_CADENCES = ['interval', 'daily'] as const;

export type DigestCadence = (typeof DIGEST_CADENCES)[number];

export const digestCadenceSchema = z.enum(DIGEST_CADENCES);
