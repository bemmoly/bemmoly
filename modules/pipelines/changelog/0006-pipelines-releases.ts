import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Releases and promotion (architecture §11). A release is immutable once written. A
 * promotion moves one release to one environment through gates, approvals and a window or
 * train; trains are schedules per scope and departures are each cut.
 */
export default changeset({
  id: '0006-pipelines-releases',
  author: 'bemmoly',
  description: 'Create releases, trains, promotions, gate results and approvals',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE pipeline_releases (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        version text NOT NULL CHECK (char_length(version) BETWEEN 1 AND 64),
        source text NOT NULL DEFAULT 'runners' CHECK (source IN ('runners', 'external')),
        run_id uuid REFERENCES pipeline_runs (id) ON DELETE SET NULL,
        commit_sha text NOT NULL,
        ref text,
        image_repository text,
        image_digests jsonb NOT NULL DEFAULT '{}'::jsonb,
        resolved_config jsonb NOT NULL DEFAULT '{}'::jsonb,
        test_summary jsonb,
        provenance jsonb,
        sbom_object_key text,
        notes text,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_releases_version_key ON pipeline_releases (application_id, version)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_releases_application_idx
        ON pipeline_releases (application_id, created_at DESC, id DESC)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_releases_created_idx ON pipeline_releases (created_at DESC, id DESC)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_trains (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        key text NOT NULL CHECK (key ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
        name text NOT NULL,
        scope_kind text NOT NULL DEFAULT 'domain'
          CHECK (scope_kind IN ('organisation', 'domain', 'group')),
        scope_id uuid,
        environment_class text NOT NULL DEFAULT 'prod'
          CHECK (environment_class IN ('dev', 'staging', 'prod')),
        schedule text NOT NULL,
        timezone text NOT NULL DEFAULT 'UTC',
        enabled boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE UNIQUE INDEX pipeline_trains_key_key ON pipeline_trains (key)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_train_departures (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        train_id uuid NOT NULL REFERENCES pipeline_trains (id) ON DELETE CASCADE,
        departs_at timestamptz NOT NULL,
        state text NOT NULL DEFAULT 'boarding' CHECK (state IN (
          'boarding', 'awaiting_approval', 'rolling_out', 'departed', 'cancelled'
        )),
        cut_at timestamptz,
        finished_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_train_departures_key
        ON pipeline_train_departures (train_id, departs_at)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_promotions (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        release_id uuid NOT NULL REFERENCES pipeline_releases (id) ON DELETE CASCADE,
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        environment_id uuid NOT NULL REFERENCES pipeline_environments (id) ON DELETE CASCADE,
        mode text NOT NULL DEFAULT 'approval'
          CHECK (mode IN ('continuous', 'approval', 'train', 'coordinated')),
        departure_id uuid REFERENCES pipeline_train_departures (id) ON DELETE SET NULL,
        coordination_id uuid,
        coordination_order integer,
        state text NOT NULL DEFAULT 'requested' CHECK (state IN (
          'requested', 'gating', 'awaiting_approval', 'scheduled', 'rolling_out',
          'succeeded', 'rolled_back', 'cancelled', 'failed'
        )),
        plan jsonb NOT NULL DEFAULT '{}'::jsonb,
        policy_versions uuid[] NOT NULL DEFAULT '{}',
        decision_id uuid REFERENCES pipeline_decisions (id) ON DELETE SET NULL,
        supersede_key text,
        requested_by uuid REFERENCES users (id) ON DELETE SET NULL,
        expires_at timestamptz,
        finished_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_promotions_application_idx
        ON pipeline_promotions (application_id, created_at DESC)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_promotions_release_idx ON pipeline_promotions (release_id)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_promotions_open_idx ON pipeline_promotions (state, environment_id)
        WHERE state IN ('requested', 'gating', 'awaiting_approval', 'scheduled', 'rolling_out')`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_promotions_departure_idx ON pipeline_promotions (departure_id)
        WHERE departure_id IS NOT NULL`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_promotions_coordination_idx ON pipeline_promotions (coordination_id)
        WHERE coordination_id IS NOT NULL`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_gate_results (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        promotion_id uuid NOT NULL REFERENCES pipeline_promotions (id) ON DELETE CASCADE,
        gate text NOT NULL,
        state text NOT NULL CHECK (state IN ('pass', 'fail', 'pending')),
        reason text NOT NULL,
        evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
        recheck_at timestamptz,
        evaluated_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_gate_results_key ON pipeline_gate_results (promotion_id, gate)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_gate_results_recheck_idx ON pipeline_gate_results (recheck_at)
        WHERE state = 'pending'`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_approvals (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        promotion_id uuid NOT NULL REFERENCES pipeline_promotions (id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        requirement text NOT NULL,
        decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
        release_digest text NOT NULL,
        comment text,
        expires_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_approvals_key ON pipeline_approvals (promotion_id, user_id)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_approvals_user_idx ON pipeline_approvals (user_id, created_at DESC)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE pipeline_approvals`);
    await ctx.exec(sql`DROP TABLE pipeline_gate_results`);
    await ctx.exec(sql`DROP TABLE pipeline_promotions`);
    await ctx.exec(sql`DROP TABLE pipeline_train_departures`);
    await ctx.exec(sql`DROP TABLE pipeline_trains`);
    await ctx.exec(sql`DROP TABLE pipeline_releases`);
  },
});
