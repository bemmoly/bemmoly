import { z } from 'zod';
import { notificationSchema } from '../notifications/api.ts';
import { notificationChannelSchema } from '../notifications/kinds.ts';
import { pageSchema } from './common.ts';

/*
 * The web shell's request and page shapes around the email and notifications
 * stream's own schemas: one inbox item (notificationSchema) carries every id it
 * stands for and its actors, and channels are that stream's.
 */

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

export type Notification = z.infer<typeof notificationSchema>;
export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;
export type NotificationsPage = z.infer<typeof notificationsPageSchema>;
export type DigestSettings = z.infer<typeof digestSettingsSchema>;
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export type UpdateNotificationPreferencesRequest = z.infer<
  typeof updateNotificationPreferencesRequestSchema
>;
