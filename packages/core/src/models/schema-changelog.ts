import { boolean, integer, jsonb, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { timestamptz } from './conventions.ts';

/**
 * The changelog runner's own table (tech design 7.1). Like Liquibase's
 * DATABASECHANGELOG it is created by the runner itself before any changeset
 * runs, and keyed by (module, id) rather than a UUID because the runner looks
 * rows up by that pair. Rows are never deleted; rollback changes `state`.
 */
export const schemaChangelog = pgTable(
  'schema_changelog',
  {
    module: text('module').notNull(),
    id: text('id').notNull(),
    author: text('author').notNull(),
    description: text('description').notNull().default(''),
    checksum: text('checksum').notNull(),
    executedAt: timestamptz('executed_at').notNull().defaultNow(),
    executionMs: integer('execution_ms').notNull().default(0),
    orderExecuted: integer('order_executed').notNull(),
    appVersion: text('app_version').notNull(),
    contexts: text('contexts').array().notNull().default([]),
    state: text('state', { enum: ['ran', 'marked_ran', 'rolled_back', 'started'] }).notNull(),
    /** The newest of `tags`, for readers that predate `tags`. */
    tag: text('tag'),
    /** Every tag on the row, oldest first: several upgrades can tag the same row. */
    tags: text('tags').array().notNull().default([]),
    /** Backfill progress keyed by call, so an interrupted changeset resumes. */
    progress: jsonb('progress').$type<Record<string, unknown>>().notNull().default({}),
    slow: boolean('slow').notNull().default(false),
    irreversible: boolean('irreversible').notNull().default(false),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.module, table.id] })],
);

export type SchemaChangelogRow = typeof schemaChangelog.$inferSelect;
