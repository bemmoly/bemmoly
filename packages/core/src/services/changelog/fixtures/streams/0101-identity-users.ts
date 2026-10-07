import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

export default changeset({
  id: '0101-identity-users',
  author: 'keerthi',
  description: 'Create users, auth_providers, auth_identities and password_reset_tokens',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        email text NOT NULL,
        name text NOT NULL,
        avatar_key text,
        status text NOT NULL DEFAULT 'active'
          CONSTRAINT users_status_check CHECK (status IN ('active', 'invited', 'deactivated')),
        is_break_glass boolean NOT NULL DEFAULT false,
        role_id uuid NOT NULL REFERENCES roles (id) ON DELETE RESTRICT,
        theme_pref text,
        locale text,
        timezone text,
        privilege_version integer NOT NULL DEFAULT 1,
        last_seen_at timestamptz,
        deactivated_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE UNIQUE INDEX users_email_key ON users (lower(email))`);
    await ctx.exec(sql`CREATE INDEX users_role_id_idx ON users (role_id)`);
    await ctx.exec(sql`
      CREATE TABLE auth_providers (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        kind text NOT NULL
          CONSTRAINT auth_providers_kind_check CHECK (kind IN ('password', 'oidc', 'saml')),
        display_name text NOT NULL,
        config_encrypted text,
        auto_provision boolean NOT NULL DEFAULT false,
        default_role_id uuid REFERENCES roles (id) ON DELETE SET NULL,
        group_mappings jsonb NOT NULL DEFAULT '{}'::jsonb,
        enabled boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX auth_providers_password_key ON auth_providers (kind)
        WHERE kind = 'password'`);
    await ctx.exec(sql`
      CREATE TABLE auth_identities (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        provider_id uuid NOT NULL REFERENCES auth_providers (id) ON DELETE RESTRICT,
        subject text NOT NULL,
        password_hash text,
        last_used_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX auth_identities_provider_subject_key
        ON auth_identities (provider_id, subject)`);
    await ctx.exec(sql`CREATE INDEX auth_identities_user_id_idx ON auth_identities (user_id)`);
    await ctx.exec(sql`
      CREATE TABLE password_reset_tokens (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        token_hash text NOT NULL,
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        requested_ip text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX password_reset_tokens_token_hash_key
        ON password_reset_tokens (token_hash)`);
    await ctx.exec(sql`
      CREATE INDEX password_reset_tokens_user_id_idx ON password_reset_tokens (user_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE password_reset_tokens`);
    await ctx.exec(sql`DROP TABLE auth_identities`);
    await ctx.exec(sql`DROP TABLE auth_providers`);
    await ctx.exec(sql`DROP TABLE users`);
  },
});
