import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Access and policy (architecture §10). Bindings give a team (or, for break-glass only, a
 * person until a set time) a role at a scope of the catalog tree, optionally for one class
 * of environment. Policies are versioned CEL; every protected decision stores its trace.
 * Freezes and on-call are facts the policy engine resolves before it evaluates.
 */
export default changeset({
  id: '0003-pipelines-access',
  author: 'bemmoly',
  description: 'Create role bindings, policies, decisions, freezes and on-call',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE pipeline_role_bindings (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        subject_kind text NOT NULL CHECK (subject_kind IN ('team', 'user')),
        subject_id uuid NOT NULL,
        role text NOT NULL CHECK (role IN (
          'viewer', 'developer', 'maintainer', 'release_manager', 'platform_admin', 'auditor'
        )),
        scope_kind text NOT NULL
          CHECK (scope_kind IN ('organisation', 'domain', 'group', 'application')),
        scope_id uuid,
        environment_class text CHECK (environment_class IN ('dev', 'staging', 'prod')),
        expires_at timestamptz,
        reason text,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK ((scope_kind = 'organisation') = (scope_id IS NULL)),
        CHECK (subject_kind = 'team' OR expires_at IS NOT NULL)
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_role_bindings_key ON pipeline_role_bindings
        (subject_kind, subject_id, role, scope_kind, scope_id, environment_class) NULLS NOT DISTINCT`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_role_bindings_scope_idx
        ON pipeline_role_bindings (scope_kind, scope_id)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_role_bindings_subject_idx
        ON pipeline_role_bindings (subject_kind, subject_id)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_policies (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        key text NOT NULL CHECK (key ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
        scope_kind text NOT NULL DEFAULT 'organisation'
          CHECK (scope_kind IN ('organisation', 'domain', 'group', 'application')),
        scope_id uuid,
        current_version integer NOT NULL DEFAULT 1,
        enabled boolean NOT NULL DEFAULT true,
        source_repository text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK ((scope_kind = 'organisation') = (scope_id IS NULL))
      )`);
    await ctx.exec(sql`CREATE UNIQUE INDEX pipeline_policies_key_key ON pipeline_policies (key)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_policies_scope_idx ON pipeline_policies (scope_kind, scope_id)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_policy_versions (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        policy_id uuid NOT NULL REFERENCES pipeline_policies (id) ON DELETE CASCADE,
        version integer NOT NULL CHECK (version > 0),
        applies text NOT NULL,
        requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
        sentence text NOT NULL,
        source text NOT NULL,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        approved_by uuid REFERENCES users (id) ON DELETE SET NULL,
        approved_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_policy_versions_key
        ON pipeline_policy_versions (policy_id, version)`);
    // Append-only and high volume: a decision is written once with its trace and never
    // changes, so there is no updated_at, and BRIN keeps the time index tiny.
    await ctx.exec(sql`
      CREATE TABLE pipeline_decisions (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        actor_kind text NOT NULL,
        actor_id text NOT NULL,
        user_id uuid REFERENCES users (id) ON DELETE SET NULL,
        action text NOT NULL,
        application_id uuid REFERENCES pipeline_applications (id) ON DELETE SET NULL,
        environment_id uuid REFERENCES pipeline_environments (id) ON DELETE SET NULL,
        resource jsonb NOT NULL DEFAULT '{}'::jsonb,
        allowed boolean NOT NULL,
        trace jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_decisions_created_brin ON pipeline_decisions USING brin (created_at)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_decisions_user_idx ON pipeline_decisions (user_id, created_at DESC)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_decisions_application_idx
        ON pipeline_decisions (application_id, created_at DESC)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_freezes (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
        scope_kind text NOT NULL DEFAULT 'organisation'
          CHECK (scope_kind IN ('organisation', 'domain', 'group', 'application')),
        scope_id uuid,
        environment_class text CHECK (environment_class IN ('dev', 'staging', 'prod')),
        starts_at timestamptz NOT NULL,
        ends_at timestamptz NOT NULL,
        reason text,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK (ends_at > starts_at),
        CHECK ((scope_kind = 'organisation') = (scope_id IS NULL))
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_freezes_window_idx ON pipeline_freezes (ends_at, starts_at)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_oncall (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        schedule_key text NOT NULL CHECK (schedule_key ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
        team_id uuid REFERENCES teams (id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        starts_at timestamptz NOT NULL,
        ends_at timestamptz NOT NULL,
        source text NOT NULL DEFAULT 'schedule' CHECK (source IN ('schedule', 'integration')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK (ends_at > starts_at)
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_oncall_schedule_idx ON pipeline_oncall (schedule_key, ends_at)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_oncall_user_idx ON pipeline_oncall (user_id, ends_at)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE pipeline_oncall`);
    await ctx.exec(sql`DROP TABLE pipeline_freezes`);
    await ctx.exec(sql`DROP TABLE pipeline_decisions`);
    await ctx.exec(sql`DROP TABLE pipeline_policy_versions`);
    await ctx.exec(sql`DROP TABLE pipeline_policies`);
    await ctx.exec(sql`DROP TABLE pipeline_role_bindings`);
  },
});
