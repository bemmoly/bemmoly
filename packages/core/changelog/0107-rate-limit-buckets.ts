import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

export default changeset({
  id: '0107-rate-limit-buckets',
  author: 'keerthi',
  description: 'Create the unlogged rate_limit_buckets table shared by every replica',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE UNLOGGED TABLE rate_limit_buckets (
        key text PRIMARY KEY,
        count integer NOT NULL,
        expires_at timestamptz NOT NULL
      )`);
    await ctx.exec(sql`
      CREATE INDEX rate_limit_buckets_expires_at_idx ON rate_limit_buckets (expires_at)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE rate_limit_buckets`);
  },
});
