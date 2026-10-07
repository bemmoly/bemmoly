import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

export default changeset({
  id: '0102-identity-sessions',
  author: 'keerthi',
  description: 'Create sessions and api_tokens, both stored as sha256 hashes only',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE sessions (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        token_hash text NOT NULL,
        previous_token_hash text,
        rotated_at timestamptz,
        expires_at timestamptz NOT NULL,
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        ip text,
        user_agent text,
        privilege_version integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE UNIQUE INDEX sessions_token_hash_key ON sessions (token_hash)`);
    await ctx.exec(sql`
      CREATE INDEX sessions_previous_token_hash_idx ON sessions (previous_token_hash)
        WHERE previous_token_hash IS NOT NULL`);
    await ctx.exec(sql`CREATE INDEX sessions_user_id_idx ON sessions (user_id)`);
    await ctx.exec(sql`CREATE INDEX sessions_expires_at_idx ON sessions (expires_at)`);
    await ctx.exec(sql`
      CREATE TABLE api_tokens (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        name text NOT NULL,
        token_hash text NOT NULL,
        token_prefix text NOT NULL,
        scopes text[] NOT NULL,
        last_used_at timestamptz,
        expires_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE UNIQUE INDEX api_tokens_token_hash_key ON api_tokens (token_hash)`);
    await ctx.exec(sql`CREATE INDEX api_tokens_user_id_idx ON api_tokens (user_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE api_tokens`);
    await ctx.exec(sql`DROP TABLE sessions`);
  },
});
