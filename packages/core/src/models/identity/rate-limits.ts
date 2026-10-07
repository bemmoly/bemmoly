import { index, integer, pgTable, text } from 'drizzle-orm/pg-core';
import { timestampTz } from './columns.ts';

/**
 * Fixed-window counters shared by every replica. Created UNLOGGED in the
 * changeset: losing counters on a crash is acceptable, write amplification is not.
 * The natural key is the bucket, so this table has no UUID id.
 */
export const rateLimitBuckets = pgTable(
  'rate_limit_buckets',
  {
    key: text('key').primaryKey(),
    count: integer('count').notNull(),
    expiresAt: timestampTz('expires_at').notNull(),
  },
  (t) => [index('rate_limit_buckets_expires_at_idx').on(t.expiresAt)],
);
