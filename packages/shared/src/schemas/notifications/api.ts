import { z } from 'zod';
import { digestCadenceSchema, notificationChannelSchema, notificationKindSchema } from './kinds.ts';

export const NOTIFICATION_PAGE_MAX = 200;

export const notificationActorSchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
});

export const notificationTargetSchema = z.object({
  kind: z.string(),
  id: z.string(),
  label: z.string().nullable(),
  url: z.string().nullable(),
});

/**
 * One inbox entry. Rows about the same target and kind on one page are grouped
 * at read time: `ids` lists every row in the group, newest first, and `summary`
 * reads "Aisha K. and 2 others commented on PLT-204".
 */
export const notificationSchema = z.object({
  id: z.string(),
  ids: z.array(z.string()),
  kind: notificationKindSchema,
  verb: z.string(),
  summary: z.string(),
  actors: z.array(notificationActorSchema),
  actorCount: z.number().int().nonnegative(),
  target: notificationTargetSchema,
  body: z.string(),
  read: z.boolean(),
  createdAt: z.iso.datetime(),
});

export const notificationListQuerySchema = z.object({
  /** The `nextCursor` of the previous page. */
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(NOTIFICATION_PAGE_MAX).default(50),
  unread: z.stringbool().optional(),
});

export const notificationListResponseSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
  unreadCount: z.number().int().nonnegative(),
});

export const notificationIdParamsSchema = z.object({ id: z.uuid() });

export const notificationPatchBodySchema = z.object({ read: z.boolean() });

/** Every row the change touched; `read: true` also marks the older unread rows of the group. */
export const notificationPatchResponseSchema = z.object({
  ids: z.array(z.string()),
  read: z.boolean(),
});

export const notificationReadAllResponseSchema = z.object({
  updated: z.number().int().nonnegative(),
});

const timeZoneSchema = z
  .string()
  .max(64)
  .refine(
    (value) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Not a known time zone' },
  );

export const digestScheduleSchema = z.object({
  cadence: digestCadenceSchema,
  /** Local hour of the daily summary; used when cadence is `daily`. */
  dailyHour: z.number().int().min(0).max(23),
  timeZone: timeZoneSchema,
});

export const notificationPreferenceSchema = z.object({
  kind: notificationKindSchema,
  channel: notificationChannelSchema,
  defaultChannel: notificationChannelSchema,
});

export const notificationPreferencesResponseSchema = z.object({
  kinds: z.array(notificationPreferenceSchema),
  digest: digestScheduleSchema,
});

export const notificationPreferencesPutBodySchema = z.object({
  kinds: z.record(notificationKindSchema, notificationChannelSchema).optional(),
  digest: digestScheduleSchema.optional(),
});

export type NotificationActor = z.infer<typeof notificationActorSchema>;
export type NotificationTarget = z.infer<typeof notificationTargetSchema>;
export type NotificationItem = z.infer<typeof notificationSchema>;
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type NotificationListResponse = z.infer<typeof notificationListResponseSchema>;
export type NotificationPatchBody = z.infer<typeof notificationPatchBodySchema>;
export type NotificationPatchResponse = z.infer<typeof notificationPatchResponseSchema>;
export type NotificationReadAllResponse = z.infer<typeof notificationReadAllResponseSchema>;
export type DigestSchedule = z.infer<typeof digestScheduleSchema>;
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;
export type NotificationPreferencesResponse = z.infer<typeof notificationPreferencesResponseSchema>;
export type NotificationPreferencesPutBody = z.infer<typeof notificationPreferencesPutBodySchema>;
