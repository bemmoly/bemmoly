import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Single sign-on and SCIM. auth_providers gains the domain allow-list, the group to role
 * mappings, the preset and the last test result; its existing group_mappings column keeps
 * group to team mappings. The previous minor ignores the new columns and tables, and never
 * reads providers other than password, so a rollback of the app alone stays safe.
 */
export default changeset({
  id: '0111-identity-sso',
  author: 'keerthi',
  description: 'Add SSO provider columns, sign-in flows, assertion replay ids and SCIM tables',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE auth_providers
        ADD COLUMN allowed_domains jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN role_mappings jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN preset text,
        ADD COLUMN last_test jsonb`);
    await ctx.exec(sql`
      CREATE TABLE auth_sso_flows (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        provider_id uuid NOT NULL REFERENCES auth_providers (id) ON DELETE CASCADE,
        state_hash text NOT NULL,
        binding_hash text NOT NULL,
        secrets_encrypted text NOT NULL,
        request_id text,
        return_to text NOT NULL,
        test_user_id uuid REFERENCES users (id) ON DELETE CASCADE,
        result jsonb,
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(
      sql`CREATE UNIQUE INDEX auth_sso_flows_state_hash_key ON auth_sso_flows (state_hash)`,
    );
    await ctx.exec(sql`CREATE INDEX auth_sso_flows_expires_at_idx ON auth_sso_flows (expires_at)`);
    await ctx.exec(sql`
      CREATE INDEX auth_sso_flows_provider_id_idx ON auth_sso_flows (provider_id)`);
    await ctx.exec(sql`
      CREATE TABLE auth_sso_assertions (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        provider_id uuid NOT NULL REFERENCES auth_providers (id) ON DELETE CASCADE,
        assertion_id text NOT NULL,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX auth_sso_assertions_provider_assertion_key
        ON auth_sso_assertions (provider_id, assertion_id)`);
    await ctx.exec(sql`
      CREATE INDEX auth_sso_assertions_expires_at_idx ON auth_sso_assertions (expires_at)`);
    await ctx.exec(sql`
      CREATE TABLE scim_tokens (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        name text NOT NULL,
        prefix text NOT NULL,
        token_hash text NOT NULL,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        last_used_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE UNIQUE INDEX scim_tokens_token_hash_key ON scim_tokens (token_hash)`);
    await ctx.exec(sql`
      CREATE TABLE scim_resources (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        resource_type text NOT NULL
          CONSTRAINT scim_resources_resource_type_check CHECK (resource_type IN ('user', 'group')),
        resource_id uuid NOT NULL,
        external_id text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX scim_resources_type_resource_key
        ON scim_resources (resource_type, resource_id)`);
    await ctx.exec(sql`
      CREATE INDEX scim_resources_type_external_idx ON scim_resources (resource_type, external_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE scim_resources`);
    await ctx.exec(sql`DROP TABLE scim_tokens`);
    await ctx.exec(sql`DROP TABLE auth_sso_assertions`);
    await ctx.exec(sql`DROP TABLE auth_sso_flows`);
    await ctx.exec(sql`
      ALTER TABLE auth_providers
        DROP COLUMN allowed_domains,
        DROP COLUMN role_mappings,
        DROP COLUMN preset,
        DROP COLUMN last_test`);
  },
});
