import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * OAuth for the MCP server: clients known by their metadata document, one-time authorization
 * codes, connected apps (grants) and their access and refresh tokens, stored as hashes. New
 * tables only, so the previous minor runs on this schema unchanged.
 */
export default changeset({
  id: '0112-identity-oauth',
  author: 'keerthi',
  description: 'Add OAuth clients, authorization codes, grants and tokens for MCP clients',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE oauth_clients (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        client_id text NOT NULL,
        name text NOT NULL,
        redirect_uris text[] NOT NULL,
        fetched_at timestamptz NOT NULL,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(
      sql`CREATE UNIQUE INDEX oauth_clients_client_id_key ON oauth_clients (client_id)`,
    );
    await ctx.exec(sql`
      CREATE TABLE oauth_authorization_codes (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        code_hash text NOT NULL,
        client_id uuid NOT NULL REFERENCES oauth_clients (id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        redirect_uri text NOT NULL,
        code_challenge text NOT NULL,
        resource text NOT NULL,
        scopes text[] NOT NULL,
        modules text[],
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        grant_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX oauth_authorization_codes_code_hash_key
        ON oauth_authorization_codes (code_hash)`);
    await ctx.exec(sql`
      CREATE INDEX oauth_authorization_codes_expires_at_idx
        ON oauth_authorization_codes (expires_at)`);
    await ctx.exec(sql`
      CREATE TABLE oauth_grants (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        client_id uuid NOT NULL REFERENCES oauth_clients (id) ON DELETE CASCADE,
        resource text NOT NULL,
        scopes text[] NOT NULL,
        modules text[],
        last_used_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE INDEX oauth_grants_user_id_idx ON oauth_grants (user_id)`);
    await ctx.exec(sql`CREATE INDEX oauth_grants_client_id_idx ON oauth_grants (client_id)`);
    await ctx.exec(sql`
      CREATE TABLE oauth_tokens (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        grant_id uuid NOT NULL REFERENCES oauth_grants (id) ON DELETE CASCADE,
        kind text NOT NULL CONSTRAINT oauth_tokens_kind_check CHECK (kind IN ('access', 'refresh')),
        token_hash text NOT NULL,
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(
      sql`CREATE UNIQUE INDEX oauth_tokens_token_hash_key ON oauth_tokens (token_hash)`,
    );
    await ctx.exec(sql`CREATE INDEX oauth_tokens_grant_id_idx ON oauth_tokens (grant_id)`);
    await ctx.exec(sql`CREATE INDEX oauth_tokens_expires_at_idx ON oauth_tokens (expires_at)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE oauth_tokens`);
    await ctx.exec(sql`DROP TABLE oauth_grants`);
    await ctx.exec(sql`DROP TABLE oauth_authorization_codes`);
    await ctx.exec(sql`DROP TABLE oauth_clients`);
  },
});
