import { z } from 'zod';
import { idSchema, pageQuerySchema, pageSchema, refSchema, timestampSchema } from './common.ts';

export const notificationSchema = z.object({
  id: idSchema,
  kind: z.string().min(1),
  actor: refSchema.nullable(),
  /** "requested your review on", "commented on", … */
  verb: z.string(),
  target: z
    .object({ kind: z.string(), id: idSchema, label: z.string(), href: z.string().nullable() })
    .nullable(),
  body: z.string().nullable(),
  createdAt: timestampSchema,
  readAt: timestampSchema.nullable(),
});

export const notificationsQuerySchema = pageQuerySchema.extend({
  unread: z.boolean().optional(),
});

export const notificationsPageSchema = pageSchema(notificationSchema).extend({
  unreadCount: z.number().int().nonnegative(),
});

export const updateNotificationRequestSchema = z.object({ read: z.boolean() });

export const notificationChannelSchema = z.enum([
  'in_app',
  'email_immediate',
  'email_digest',
  'off',
]);

export const notificationPreferenceSchema = z.object({
  kind: z.string().min(1),
  label: z.string(),
  description: z.string().nullable(),
  channel: notificationChannelSchema,
});

export const notificationPreferencesSchema = z.object({
  items: z.array(notificationPreferenceSchema),
});

export const updateNotificationPreferencesRequestSchema = z.object({
  items: z.array(z.object({ kind: z.string().min(1), channel: notificationChannelSchema })),
});

/** WebSocket /ws: the client subscribes to scopes such as "user:<id>". */
export const realtimeClientMessageSchema = z.object({
  type: z.enum(['subscribe', 'unsubscribe']),
  scopes: z.array(z.string().min(1)).min(1),
});

/** Events carry ids only; the client refetches through the authenticated REST API. */
export const realtimeServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('event'),
    kind: z.string().min(1),
    scope: z.string(),
    ids: z.array(z.string()),
  }),
  z.object({ type: z.literal('subscribed'), scopes: z.array(z.string()) }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);

export type Notification = z.infer<typeof notificationSchema>;
export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;
export type NotificationsPage = z.infer<typeof notificationsPageSchema>;
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;
export type UpdateNotificationPreferencesRequest = z.infer<
  typeof updateNotificationPreferencesRequestSchema
>;
export type RealtimeClientMessage = z.infer<typeof realtimeClientMessageSchema>;
export type RealtimeServerMessage = z.infer<typeof realtimeServerMessageSchema>;
