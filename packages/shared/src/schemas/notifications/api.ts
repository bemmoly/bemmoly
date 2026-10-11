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
 * reads "Aisha K. and 2 others commented on PLT-204". `done` and `snoozedUntil`
 * default because the previous minor's server does not send them.
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
  done: z.boolean().default(false),
  snoozedUntil: z.iso.datetime().nullable().default(null),
  createdAt: z.iso.datetime(),
});

/**
 * `inbox`: not done and not snoozed into the future. `done`: archived.
 * `snoozed`: not done, snoozed until a time still ahead.
 */
export const notificationViewSchema = z.enum(['inbox', 'done', 'snoozed']);

export const notificationListQuerySchema = z.object({
  /** The `nextCursor` of the previous page. */
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(NOTIFICATION_PAGE_MAX).default(50),
  unread: z.stringbool().optional(),
  view: notificationViewSchema.default('inbox'),
});

export const notificationListResponseSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
  /** Unread rows in the `inbox` view, whatever view was asked for: the badge count. */
  unreadCount: z.number().int().nonnegative(),
});

export const notificationIdParamsSchema = z.object({ id: z.uuid() });

/**
 * Any of the three, applied in the order done, snooze, read, so an explicit
 * `read` sent alongside the others has the last word.
 */
export const notificationPatchBodySchema = z
  .object({
    read: z.boolean().optional(),
    /**
     * `true` archives the entry's group and marks it read; `false` undoes that,
     * bringing the group back with the rows that were unread unread again.
     */
    done: z.boolean().optional(),
    /** Hides the group until then and makes it unread for its return; `null` ends the snooze. */
    snoozedUntil: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .refine(
    (body) => body.read !== undefined || body.done !== undefined || body.snoozedUntil !== undefined,
    'Send read, done or snoozedUntil',
  );

/**
 * Every row the change touched, and the fields the request changed as they now
 * stand on the entry. `read` is also echoed when done (read) or a snooze
 * (unread) implied it; the previous minor's server always sent it.
 */
export const notificationPatchResponseSchema = z.object({
  ids: z.array(z.string()),
  read: z.boolean().optional(),
  done: z.boolean().optional(),
  snoozedUntil: z.iso.datetime().nullable().optional(),
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
export type NotificationView = z.infer<typeof notificationViewSchema>;
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type NotificationListResponse = z.infer<typeof notificationListResponseSchema>;
export type NotificationPatchBody = z.infer<typeof notificationPatchBodySchema>;
export type NotificationPatchResponse = z.infer<typeof notificationPatchResponseSchema>;
export type NotificationReadAllResponse = z.infer<typeof notificationReadAllResponseSchema>;
export type DigestSchedule = z.infer<typeof digestScheduleSchema>;
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;
export type NotificationPreferencesResponse = z.infer<typeof notificationPreferencesResponseSchema>;
export type NotificationPreferencesPutBody = z.infer<typeof notificationPreferencesPutBodySchema>;
