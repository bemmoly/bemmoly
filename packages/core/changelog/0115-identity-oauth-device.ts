import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Device sign-in (RFC 8628) for first-party command line tools: one row per request, with
 * the device code stored as its sha256 and the short code the person types. A new table, so
 * the previous minor runs on this schema unchanged.
 */
export default changeset({
  id: '0115-identity-oauth-device',
  author: 'keerthi',
  description: 'Add device authorization requests for command line sign-in',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE oauth_device_codes (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        client_id text NOT NULL,
        device_name text NOT NULL,
        device_code_hash text NOT NULL,
        user_code text NOT NULL,
        status text NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'approved', 'denied', 'consumed')),
        user_id uuid REFERENCES users (id) ON DELETE CASCADE,
        api_token_id uuid REFERENCES api_tokens (id) ON DELETE SET NULL,
        interval_seconds integer NOT NULL DEFAULT 5 CHECK (interval_seconds > 0),
        last_polled_at timestamptz,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK (status = 'pending' OR status = 'denied' OR user_id IS NOT NULL)
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX oauth_device_codes_device_code_hash_key
        ON oauth_device_codes (device_code_hash)`);
    // A short code is only unique while someone could still type it.
    await ctx.exec(sql`
      CREATE UNIQUE INDEX oauth_device_codes_user_code_key
        ON oauth_device_codes (user_code) WHERE status = 'pending'`);
    await ctx.exec(sql`
      CREATE INDEX oauth_device_codes_expires_at_idx ON oauth_device_codes (expires_at)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE oauth_device_codes`);
  },
});
