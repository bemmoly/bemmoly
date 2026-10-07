import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Every email the product sends. Services insert here in the transaction of the
 * change that caused the mail; the `email.send` job drains it. While a row is
 * `sending`, `next_attempt_at` is its lease, so a crashed worker's row is retried.
 */
export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    kind: text('kind').notNull(),
    toAddress: text('to_address').notNull(),
    toName: text('to_name'),
    subject: text('subject').notNull(),
    html: text('html').notNull(),
    text: text('text').notNull(),
    headers: jsonb('headers').$type<Record<string, string>>().notNull().default({}),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    provider: text('provider'),
    messageId: text('message_id'),
    dedupeKey: text('dedupe_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'email_outbox_status_check',
      sql`${table.status} in ('pending', 'sending', 'sent', 'failed')`,
    ),
    uniqueIndex('email_outbox_dedupe_key_idx')
      .on(table.dedupeKey)
      .where(sql`${table.dedupeKey} is not null`),
    index('email_outbox_due_idx')
      .on(table.nextAttemptAt)
      .where(sql`${table.status} in ('pending', 'sending')`),
    index('email_outbox_failed_idx')
      .on(table.updatedAt)
      .where(sql`${table.status} = 'failed'`),
  ],
);
