import { z } from 'zod';
import { pageSchema } from './common.ts';

/**
 * Shapes confirmed by the email and notifications stream. Grouping happens on
 * the server: one item carries every id it stands for (`ids`) and its actors.
 */
export const notificationSchema = z.object({
  id: z.string().min(1),
  ids: z.array(z.string().min(1)),
  kind: z.string().min(1),
  verb: z.string(),
  summary: z.string(),
  actors: z.array(z.object({ id: z.string(), name: z.string() })),
  actorCount: z.number().int().nonnegative(),
  target: z
    .object({ kind: z.string(), id: z.string(), label: z.string(), url: z.string().nullable() })
    .nullable(),
  body: z.string().nullable(),
  read: z.boolean(),
  createdAt: z.string(),
});

export const notificationsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  unread: z.boolean().optional(),
});

export const notificationsPageSchema = pageSchema(notificationSchema).extend({
  unreadCount: z.number().int().nonnegative(),
});

export const markNotificationResponseSchema = z.object({
  ids: z.array(z.string()),
  read: z.boolean(),
});

export const readAllResponseSchema = z.object({ updated: z.number().int().nonnegative() });

/** Channel names are the server's; the page labels the ones it knows. */
export const notificationChannelSchema = z.string().min(1);

export const digestSettingsSchema = z.object({
  cadence: z.enum(['interval', 'daily']),
  dailyHour: z.number().int().min(0).max(23),
  timeZone: z.string(),
});

export const notificationPreferencesSchema = z.object({
  kinds: z.array(
    z.object({
      kind: z.string().min(1),
      channel: notificationChannelSchema,
      defaultChannel: notificationChannelSchema,
    }),
  ),
  digest: digestSettingsSchema,
});

export const updateNotificationPreferencesRequestSchema = z.object({
  kinds: z.record(z.string(), notificationChannelSchema).optional(),
  digest: digestSettingsSchema.optional(),
});

/** WebSocket /ws: the client subscribes to scopes such as "user:<id>". */
export const realtimeClientMessageSchema = z.object({
  type: z.enum(['subscribe', 'unsubscribe']),
  scopes: z.array(z.string().min(1)).min(1),
});

/**
 * Any server message naming a `kind` is an invalidation hint ("notifications",
 * "module.enabled", …); data always comes back through the REST API.
 */
export const realtimeEventSchema = z.looseObject({
  kind: z.string().min(1),
  scope: z.string().optional(),
  ids: z.array(z.string()).optional(),
});

export type Notification = z.infer<typeof notificationSchema>;
export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;
export type NotificationsPage = z.infer<typeof notificationsPageSchema>;
export type DigestSettings = z.infer<typeof digestSettingsSchema>;
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export type UpdateNotificationPreferencesRequest = z.infer<
  typeof updateNotificationPreferencesRequestSchema
>;
export type RealtimeClientMessage = z.infer<typeof realtimeClientMessageSchema>;
export type RealtimeEventMessage = z.infer<typeof realtimeEventSchema>;
