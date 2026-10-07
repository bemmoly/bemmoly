import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Inbox rows. `delivery` is the channel chosen from the recipient's preference
 * when the row was written, so the digest job knows which rows it owns. The
 * actor's name and the target's label are copied in so the inbox renders
 * without joining module tables.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id').notNull(),
    kind: text('kind').notNull(),
    actorId: uuid('actor_id'),
    actorName: text('actor_name'),
    targetKind: text('target_kind').notNull(),
    targetId: text('target_id').notNull(),
    targetLabel: text('target_label'),
    targetUrl: text('target_url'),
    body: text('body').notNull().default(''),
    reason: text('reason'),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    delivery: text('delivery').notNull(),
    dedupeKey: text('dedupe_key'),
    readAt: timestamp('read_at', { withTimezone: true }),
    emailedAt: timestamp('emailed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'notifications_delivery_check',
      sql`${table.delivery} in ('inapp', 'email_immediate', 'email_digest')`,
    ),
    index('notifications_user_id_idx').on(table.userId, table.id.desc()),
    index('notifications_unread_idx')
      .on(table.userId)
      .where(sql`${table.readAt} is null`),
    index('notifications_digest_pending_idx')
      .on(table.userId, table.id)
      .where(
        sql`${table.delivery} = 'email_digest' and ${table.emailedAt} is null and ${table.readAt} is null`,
      ),
    uniqueIndex('notifications_dedupe_key_idx')
      .on(table.userId, table.dedupeKey)
      .where(sql`${table.dedupeKey} is not null`),
  ],
);

/** Per user per kind; a missing row means the kind's default channel. */
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id').notNull(),
    kind: text('kind').notNull(),
    channel: text('channel').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'notification_preferences_channel_check',
      sql`${table.channel} in ('inapp', 'email_immediate', 'email_digest', 'off')`,
    ),
    uniqueIndex('notification_preferences_user_kind_idx').on(table.userId, table.kind),
  ],
);

/** When a user's digest goes out: every `email.digestMinutes`, or daily at a local hour. */
export const notificationSchedules = pgTable(
  'notification_schedules',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('user_id').notNull(),
    cadence: text('cadence').notNull().default('interval'),
    dailyHour: smallint('daily_hour').notNull().default(8),
    timeZone: text('time_zone').notNull().default('UTC'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('notification_schedules_cadence_check', sql`${table.cadence} in ('interval', 'daily')`),
    check('notification_schedules_daily_hour_check', sql`${table.dailyHour} between 0 and 23`),
    uniqueIndex('notification_schedules_user_id_idx').on(table.userId),
  ],
);
