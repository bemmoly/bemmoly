import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Bring your CI (architecture §7.1). CI systems sign in with their own OIDC tokens, checked
 * against an issuer's published keys and mapped to applications through trust rules per
 * repository; systems without OIDC use scoped tokens, stored hashed. Other CI systems'
 * checks and workflow runs are kept per commit so policies can use them as gates. GitHub
 * Actions is a built-in issuer.
 */
export default changeset({
  id: '0015-pipelines-ci',
  author: 'bemmoly',
  description: 'Create CI issuers, trust rules, CI tokens and external checks',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE pipeline_ci_issuers (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        key text NOT NULL CHECK (key ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
        kind text NOT NULL CHECK (kind IN ('github', 'gitlab', 'circleci', 'buildkite', 'oidc')),
        issuer text NOT NULL CHECK (issuer ~ '^https://'),
        discovery_url text NOT NULL CHECK (discovery_url ~ '^https://'),
        audience text,
        claim_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
        enabled boolean NOT NULL DEFAULT true,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(
      sql`CREATE UNIQUE INDEX pipeline_ci_issuers_key_key ON pipeline_ci_issuers (key)`,
    );
    await ctx.exec(
      sql`CREATE UNIQUE INDEX pipeline_ci_issuers_issuer_key ON pipeline_ci_issuers (issuer)`,
    );
    await ctx.exec(sql`
      INSERT INTO pipeline_ci_issuers (key, name, kind, issuer, discovery_url)
      VALUES ('github-actions', 'GitHub Actions', 'github',
        'https://token.actions.githubusercontent.com',
        'https://token.actions.githubusercontent.com/.well-known/openid-configuration')`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_ci_trust_rules (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        issuer_id uuid NOT NULL REFERENCES pipeline_ci_issuers (id) ON DELETE CASCADE,
        repository text NOT NULL CHECK (char_length(repository) BETWEEN 1 AND 300),
        refs text[] NOT NULL DEFAULT '{}',
        workflows text[] NOT NULL DEFAULT '{}',
        environments text[] NOT NULL DEFAULT '{}',
        application_ids uuid[] NOT NULL DEFAULT '{}',
        enabled boolean NOT NULL DEFAULT true,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_ci_trust_rules_repository_idx
        ON pipeline_ci_trust_rules (issuer_id, lower(repository))`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_ci_tokens (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
        token_prefix text NOT NULL,
        token_hash text NOT NULL,
        application_ids uuid[] NOT NULL CHECK (cardinality(application_ids) > 0),
        expires_at timestamptz,
        last_used_at timestamptz,
        revoked_at timestamptz,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(
      sql`CREATE UNIQUE INDEX pipeline_ci_tokens_hash_key ON pipeline_ci_tokens (token_hash)`,
    );
    await ctx.exec(sql`
      CREATE TABLE pipeline_external_checks (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        repository_full_name text NOT NULL,
        commit_sha text NOT NULL,
        kind text NOT NULL CHECK (kind IN ('check_run', 'workflow_run', 'reported')),
        name text NOT NULL,
        path text,
        status text NOT NULL CHECK (status IN ('queued', 'in_progress', 'completed')),
        conclusion text,
        url text,
        occurred_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_external_checks_key
        ON pipeline_external_checks (lower(repository_full_name), commit_sha, kind, name)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE pipeline_external_checks`);
    await ctx.exec(sql`DROP TABLE pipeline_ci_tokens`);
    await ctx.exec(sql`DROP TABLE pipeline_ci_trust_rules`);
    await ctx.exec(sql`DROP TABLE pipeline_ci_issuers`);
  },
});
