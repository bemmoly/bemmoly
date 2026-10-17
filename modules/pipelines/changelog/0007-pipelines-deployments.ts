import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Deployments and history (architecture §11, §13, §18). Every state change of a deployment
 * is an append-only event; `pipeline_current` is the materialised latest state per
 * (application, environment), written in the same transaction as each event, which is what
 * the Release map counts. `pipeline_changes` is the What changed? timeline: deploys, roll
 * backs, config, environment, access and policy changes, one indexed read per scope and
 * window. Change records are the immutable evidence a finished promotion leaves.
 */
export default changeset({
  id: '0007-pipelines-deployments',
  author: 'bemmoly',
  description: 'Create deployments, deployment events, current state, changes and records',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE pipeline_deployments (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        promotion_id uuid REFERENCES pipeline_promotions (id) ON DELETE SET NULL,
        release_id uuid NOT NULL REFERENCES pipeline_releases (id) ON DELETE CASCADE,
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        environment_id uuid NOT NULL REFERENCES pipeline_environments (id) ON DELETE CASCADE,
        kind text NOT NULL DEFAULT 'deploy' CHECK (kind IN ('deploy', 'rollback')),
        wave integer NOT NULL DEFAULT 1 CHECK (wave >= 1),
        state text NOT NULL DEFAULT 'pending' CHECK (state IN (
          'pending', 'deploying', 'canary', 'waiting', 'succeeded', 'failed', 'rolled_back',
          'cancelled'
        )),
        traffic_percent smallint NOT NULL DEFAULT 0 CHECK (traffic_percent BETWEEN 0 AND 100),
        revision text,
        previous_release_id uuid REFERENCES pipeline_releases (id) ON DELETE SET NULL,
        previous_revision text,
        rollback_of_id uuid REFERENCES pipeline_deployments (id) ON DELETE SET NULL,
        started_by uuid REFERENCES users (id) ON DELETE SET NULL,
        started_at timestamptz,
        finished_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_deployments_target_idx
        ON pipeline_deployments (application_id, environment_id, created_at DESC)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_deployments_environment_idx
        ON pipeline_deployments (environment_id, created_at DESC)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_deployments_promotion_idx ON pipeline_deployments (promotion_id)
        WHERE promotion_id IS NOT NULL`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_deployments_live_idx ON pipeline_deployments (state)
        WHERE state IN ('pending', 'deploying', 'canary', 'waiting')`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_deployments_created_brin ON pipeline_deployments USING brin (created_at)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_deployment_events (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        deployment_id uuid NOT NULL REFERENCES pipeline_deployments (id) ON DELETE CASCADE,
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        environment_id uuid NOT NULL REFERENCES pipeline_environments (id) ON DELETE CASCADE,
        release_id uuid NOT NULL REFERENCES pipeline_releases (id) ON DELETE CASCADE,
        state text NOT NULL,
        traffic_percent smallint NOT NULL DEFAULT 0,
        message text,
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        occurred_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    // Rewind reads "the latest event per (application, environment) at or before T".
    await ctx.exec(sql`
      CREATE INDEX pipeline_deployment_events_target_idx
        ON pipeline_deployment_events (application_id, environment_id, occurred_at DESC)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_deployment_events_deployment_idx
        ON pipeline_deployment_events (deployment_id, occurred_at)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_deployment_events_occurred_brin
        ON pipeline_deployment_events USING brin (occurred_at)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_current (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        environment_id uuid NOT NULL REFERENCES pipeline_environments (id) ON DELETE CASCADE,
        domain_id uuid NOT NULL REFERENCES pipeline_domains (id) ON DELETE CASCADE,
        group_id uuid NOT NULL REFERENCES pipeline_groups (id) ON DELETE CASCADE,
        release_id uuid REFERENCES pipeline_releases (id) ON DELETE SET NULL,
        version text,
        deployment_id uuid REFERENCES pipeline_deployments (id) ON DELETE SET NULL,
        state text NOT NULL DEFAULT 'idle' CHECK (state IN (
          'idle', 'deploying', 'canary', 'waiting', 'failed', 'rolled_back'
        )),
        moving_release_id uuid REFERENCES pipeline_releases (id) ON DELETE SET NULL,
        moving_version text,
        traffic_percent smallint NOT NULL DEFAULT 0,
        deployed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_current_target_key
        ON pipeline_current (application_id, environment_id)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_current_scope_idx
        ON pipeline_current (domain_id, group_id, environment_id, state)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_current_moving_idx ON pipeline_current (environment_id)
        WHERE state <> 'idle'`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_changes (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        kind text NOT NULL CHECK (kind IN (
          'deploy', 'rollback', 'config', 'environment', 'access', 'policy', 'infrastructure'
        )),
        application_id uuid REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        environment_id uuid REFERENCES pipeline_environments (id) ON DELETE CASCADE,
        domain_id uuid REFERENCES pipeline_domains (id) ON DELETE CASCADE,
        group_id uuid REFERENCES pipeline_groups (id) ON DELETE CASCADE,
        actor_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
        actor_label text,
        summary text NOT NULL,
        detail text,
        ref_kind text,
        ref_id uuid,
        revertible boolean NOT NULL DEFAULT false,
        occurred_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_changes_domain_idx ON pipeline_changes (domain_id, occurred_at DESC)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_changes_group_idx ON pipeline_changes (group_id, occurred_at DESC)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_changes_application_idx
        ON pipeline_changes (application_id, occurred_at DESC)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_changes_occurred_idx ON pipeline_changes (occurred_at DESC)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_change_records (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        promotion_id uuid NOT NULL REFERENCES pipeline_promotions (id) ON DELETE CASCADE,
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        environment_id uuid NOT NULL REFERENCES pipeline_environments (id) ON DELETE CASCADE,
        release_id uuid NOT NULL REFERENCES pipeline_releases (id) ON DELETE CASCADE,
        outcome text NOT NULL CHECK (outcome IN ('succeeded', 'rolled_back', 'cancelled', 'failed')),
        record jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_change_records_promotion_key
        ON pipeline_change_records (promotion_id)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_change_records_created_idx
        ON pipeline_change_records (created_at DESC, id DESC)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE pipeline_change_records`);
    await ctx.exec(sql`DROP TABLE pipeline_changes`);
    await ctx.exec(sql`DROP TABLE pipeline_current`);
    await ctx.exec(sql`DROP TABLE pipeline_deployment_events`);
    await ctx.exec(sql`DROP TABLE pipeline_deployments`);
  },
});
