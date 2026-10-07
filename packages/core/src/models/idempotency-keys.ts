import { index, integer, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { primaryId, timestamps, timestamptz } from './conventions.ts';

/**
 * Stored responses for the Idempotency-Key header on creating POSTs (kept 24
 * hours) and for job-level idempotency. `system.housekeeping` deletes expired rows.
 */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: primaryId(),
    scope: text('scope').notNull(),
    key: text('key').notNull(),
    requestHash: text('request_hash'),
    statusCode: integer('status_code'),
    response: jsonb('response'),
    expiresAt: timestamptz('expires_at').notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('idempotency_keys_scope_key_idx').on(table.scope, table.key),
    index('idempotency_keys_expires_at_idx').on(table.expiresAt),
  ],
);

export type IdempotencyKeyRow = typeof idempotencyKeys.$inferSelect;
