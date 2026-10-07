import { changeset, sql } from '../src/changelog.ts';

export default changeset({
  id: '0003-idempotency-keys',
  author: 'bemmoly',
  description: 'Create idempotency_keys for Idempotency-Key replays, expired by housekeeping',
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE idempotency_keys (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        scope text NOT NULL,
        key text NOT NULL,
        request_hash text,
        status_code integer,
        response jsonb,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(
      sql`CREATE UNIQUE INDEX idempotency_keys_scope_key_idx ON idempotency_keys (scope, key)`,
    );
    await ctx.exec(
      sql`CREATE INDEX idempotency_keys_expires_at_idx ON idempotency_keys (expires_at)`,
    );
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE idempotency_keys`);
  },
});
