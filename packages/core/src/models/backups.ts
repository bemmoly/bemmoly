import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

/**
 * One row per backup run: scheduled, manual or pre-upgrade. The files live in the
 * destinations listed in `locations`; the row is the index the UI and retention read.
 * Created by changeset core/0300-backups.
 */
export const backups = pgTable(
  'backups',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    kind: text('kind').notNull(),
    status: text('status').notNull().default('running'),
    setName: text('set_name').notNull().unique(),
    appVersion: text('app_version').notNull(),
    changelogTag: text('changelog_tag'),
    /** The schedule slot a scheduled run covers; unique so a duplicated tick cannot run twice. */
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    attachmentMode: text('attachment_mode').notNull().default('incremental'),
    /** The previous backup in the attachment chain; null for a full copy. */
    baseBackupId: uuid('base_backup_id').references((): AnyPgColumn => backups.id, {
      onDelete: 'set null',
    }),
    encrypted: boolean('encrypted').notNull().default(false),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull().default(0),
    databaseBytes: bigint('database_bytes', { mode: 'number' }).notNull().default(0),
    attachmentsBytes: bigint('attachments_bytes', { mode: 'number' }).notNull().default(0),
    locations: jsonb('locations')
      .notNull()
      .default(sql`'[]'::jsonb`),
    manifest: jsonb('manifest'),
    verificationState: text('verification_state').notNull().default('pending'),
    verificationMessage: text('verification_message'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    drilledAt: timestamp('drilled_at', { withTimezone: true }),
    error: text('error'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('backups_kind_created_at_idx').on(table.kind, table.createdAt),
    index('backups_status_created_at_idx').on(table.status, table.createdAt),
    uniqueIndex('backups_scheduled_for_key')
      .on(table.scheduledFor)
      .where(sql`scheduled_for is not null and status <> 'failed'`),
  ],
);

export type BackupRow = typeof backups.$inferSelect;
