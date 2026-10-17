import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Clouds and environments (architecture §14). A connection is a keyless identity in one
 * provider; accounts are the provider's projects, accounts or namespaces under it; resources
 * are the landing zone's declared kinds with what was observed. An environment names its
 * provider and default account; per-domain layouts map (environment, domain) to an account.
 * Paths say, per tier, which environments a release crosses and in which stage.
 */
export default changeset({
  id: '0002-pipelines-environments',
  author: 'bemmoly',
  description: 'Create cloud connections, accounts, resources, environments and paths',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE cloud_connections (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        provider text NOT NULL CHECK (provider IN ('gcp', 'aws', 'azure', 'kubernetes', 'local')),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
        status text NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'connected', 'failed', 'disconnected')),
        principal text,
        boundary_ref text,
        layout text NOT NULL DEFAULT 'per-domain-environment'
          CHECK (layout IN ('per-environment', 'per-domain-environment', 'per-group-environment')),
        config jsonb NOT NULL DEFAULT '{}'::jsonb,
        secret_encrypted text,
        last_checked_at timestamptz,
        last_error text,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX cloud_connections_name_key ON cloud_connections (lower(name))`);
    await ctx.exec(sql`
      CREATE TABLE cloud_accounts (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        connection_id uuid NOT NULL REFERENCES cloud_connections (id) ON DELETE CASCADE,
        external_id text NOT NULL,
        name text NOT NULL,
        domain_id uuid REFERENCES pipeline_domains (id) ON DELETE SET NULL,
        environment_class text CHECK (environment_class IN ('dev', 'staging', 'prod')),
        purpose text NOT NULL DEFAULT 'workload' CHECK (purpose IN ('workload', 'ci', 'control')),
        status text NOT NULL DEFAULT 'planned'
          CHECK (status IN ('planned', 'creating', 'ready', 'drifted', 'failed')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX cloud_accounts_external_key
        ON cloud_accounts (connection_id, external_id)`);
    await ctx.exec(sql`CREATE INDEX cloud_accounts_domain_idx ON cloud_accounts (domain_id)`);
    await ctx.exec(sql`
      CREATE TABLE cloud_resources (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        account_id uuid NOT NULL REFERENCES cloud_accounts (id) ON DELETE CASCADE,
        kind text NOT NULL CHECK (kind IN (
          'account', 'network', 'registry_access', 'deployer_identity', 'runtime_identity',
          'budget', 'logging', 'service_api', 'secret_store'
        )),
        name text NOT NULL,
        desired jsonb NOT NULL DEFAULT '{}'::jsonb,
        observed jsonb,
        spec_hash text,
        status text NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'applying', 'ready', 'drifted', 'failed')),
        last_reconciled_at timestamptz,
        last_error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX cloud_resources_kind_name_key ON cloud_resources (account_id, kind, name)`);
    await ctx.exec(sql`
      CREATE INDEX cloud_resources_unsettled_idx ON cloud_resources (status)
        WHERE status <> 'ready'`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_environments (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        key text NOT NULL CHECK (key ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
        class text NOT NULL CHECK (class IN ('dev', 'staging', 'prod')),
        provider text NOT NULL DEFAULT 'gcp'
          CHECK (provider IN ('gcp', 'aws', 'azure', 'kubernetes', 'local')),
        cloud_account_id uuid REFERENCES cloud_accounts (id) ON DELETE SET NULL,
        region text,
        position integer NOT NULL DEFAULT 0,
        protection jsonb NOT NULL DEFAULT '{}'::jsonb,
        archived_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_environments_key_key ON pipeline_environments (key)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_environments_position_idx ON pipeline_environments (position, id)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_environment_accounts (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        environment_id uuid NOT NULL REFERENCES pipeline_environments (id) ON DELETE CASCADE,
        domain_id uuid REFERENCES pipeline_domains (id) ON DELETE CASCADE,
        cloud_account_id uuid NOT NULL REFERENCES cloud_accounts (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_environment_accounts_key
        ON pipeline_environment_accounts (environment_id, domain_id) NULLS NOT DISTINCT`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_environment_accounts_account_idx
        ON pipeline_environment_accounts (cloud_account_id)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_environment_paths (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        tier smallint NOT NULL CHECK (tier BETWEEN 0 AND 2),
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_environment_paths_tier_key ON pipeline_environment_paths (tier)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_environment_path_steps (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        path_id uuid NOT NULL REFERENCES pipeline_environment_paths (id) ON DELETE CASCADE,
        environment_id uuid NOT NULL REFERENCES pipeline_environments (id) ON DELETE CASCADE,
        stage integer NOT NULL CHECK (stage >= 0),
        bake_minutes integer NOT NULL DEFAULT 0 CHECK (bake_minutes >= 0),
        auto_promote boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_environment_path_steps_key
        ON pipeline_environment_path_steps (path_id, environment_id)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_environment_path_steps_environment_idx
        ON pipeline_environment_path_steps (environment_id)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_variables (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        environment_id uuid REFERENCES pipeline_environments (id) ON DELETE CASCADE,
        name text NOT NULL CHECK (name ~ '^[A-Z_][A-Z0-9_]{0,127}$'),
        value text,
        secret_ref text,
        version integer NOT NULL DEFAULT 1,
        updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK ((value IS NULL) <> (secret_ref IS NULL))
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_variables_name_key
        ON pipeline_variables (application_id, environment_id, name) NULLS NOT DISTINCT`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE pipeline_variables`);
    await ctx.exec(sql`DROP TABLE pipeline_environment_path_steps`);
    await ctx.exec(sql`DROP TABLE pipeline_environment_paths`);
    await ctx.exec(sql`DROP TABLE pipeline_environment_accounts`);
    await ctx.exec(sql`DROP TABLE pipeline_environments`);
    await ctx.exec(sql`DROP TABLE cloud_resources`);
    await ctx.exec(sql`DROP TABLE cloud_accounts`);
    await ctx.exec(sql`DROP TABLE cloud_connections`);
  },
});
