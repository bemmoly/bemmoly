import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * What the promotion engine and rollouts need beyond the release and deployment tables
 * (architecture §11, §13, §18): where each deployment is in its plan and when it next acts,
 * the canary samples it judged, hourly snapshots of pipeline_current so rewind reads one
 * snapshot plus the events since, and external webhook gates a security team plugs in.
 */
export default changeset({
  id: '0013-pipelines-shipping',
  author: 'bemmoly',
  description: 'Add rollout progress, canary samples, current snapshots and webhook gates',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE pipeline_deployments
        ADD COLUMN phase text NOT NULL DEFAULT 'deploy'
          CHECK (phase IN ('deploy', 'step', 'watch', 'paused', 'done')),
        ADD COLUMN plan jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN step_index integer NOT NULL DEFAULT 0,
        ADD COLUMN step_started_at timestamptz,
        ADD COLUMN next_action_at timestamptz,
        ADD COLUMN failing_samples integer NOT NULL DEFAULT 0,
        ADD COLUMN pause_reason text,
        ADD COLUMN reason text`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_deployments_due_idx ON pipeline_deployments (next_action_at)
        WHERE state IN ('pending', 'deploying', 'canary')`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_promotions
        ADD COLUMN release_digest text,
        ADD COLUMN next_check_at timestamptz,
        ADD COLUMN current_wave integer NOT NULL DEFAULT 0,
        ADD COLUMN failure_policy text NOT NULL DEFAULT 'stop_all'
          CHECK (failure_policy IN ('stop_all', 'continue_independent')),
        ADD COLUMN freeze_override jsonb,
        ADD COLUMN note text,
        ADD COLUMN outcome_reason text,
        ADD COLUMN approved_at timestamptz,
        ADD COLUMN started_at timestamptz`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_promotions_due_idx ON pipeline_promotions (next_check_at)
        WHERE state IN ('requested', 'gating', 'awaiting_approval', 'scheduled', 'rolling_out')`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_train_departures
        ADD COLUMN approved_by uuid REFERENCES users (id) ON DELETE SET NULL,
        ADD COLUMN approved_at timestamptz`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_canary_samples (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        deployment_id uuid NOT NULL REFERENCES pipeline_deployments (id) ON DELETE CASCADE,
        step_index integer NOT NULL,
        phase text NOT NULL CHECK (phase IN ('step', 'watch')),
        traffic_percent smallint NOT NULL,
        metric text NOT NULL CHECK (metric IN ('error_rate', 'latency_p95')),
        canary_value double precision,
        stable_value double precision,
        canary_requests integer NOT NULL DEFAULT 0,
        verdict text NOT NULL CHECK (verdict IN ('pass', 'marginal', 'fail', 'pending')),
        sampled_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_canary_samples_deployment_idx
        ON pipeline_canary_samples (deployment_id, sampled_at)`);
    // One row per (application, environment) per hour: rewind starts from the latest
    // snapshot at or before T and replays only the events after it.
    await ctx.exec(sql`
      CREATE TABLE pipeline_current_snapshots (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        taken_at timestamptz NOT NULL,
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        environment_id uuid NOT NULL REFERENCES pipeline_environments (id) ON DELETE CASCADE,
        release_id uuid REFERENCES pipeline_releases (id) ON DELETE SET NULL,
        version text,
        state text NOT NULL,
        moving_release_id uuid REFERENCES pipeline_releases (id) ON DELETE SET NULL,
        moving_version text,
        traffic_percent smallint NOT NULL DEFAULT 0,
        deployment_id uuid REFERENCES pipeline_deployments (id) ON DELETE SET NULL,
        deployed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_current_snapshots_taken_idx
        ON pipeline_current_snapshots (taken_at, application_id)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_gate_webhooks (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        key text NOT NULL CHECK (key ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
        url text NOT NULL,
        secret_encrypted text,
        timeout_ms integer NOT NULL DEFAULT 5000 CHECK (timeout_ms BETWEEN 100 AND 30000),
        enabled boolean NOT NULL DEFAULT true,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_gate_webhooks_key_key ON pipeline_gate_webhooks (key)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE pipeline_gate_webhooks`);
    await ctx.exec(sql`DROP TABLE pipeline_current_snapshots`);
    await ctx.exec(sql`DROP TABLE pipeline_canary_samples`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_train_departures DROP COLUMN approved_at, DROP COLUMN approved_by`);
    await ctx.exec(sql`DROP INDEX pipeline_promotions_due_idx`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_promotions
        DROP COLUMN started_at, DROP COLUMN approved_at, DROP COLUMN outcome_reason,
        DROP COLUMN note, DROP COLUMN freeze_override, DROP COLUMN failure_policy,
        DROP COLUMN current_wave, DROP COLUMN next_check_at, DROP COLUMN release_digest`);
    await ctx.exec(sql`DROP INDEX pipeline_deployments_due_idx`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_deployments
        DROP COLUMN reason, DROP COLUMN pause_reason, DROP COLUMN failing_samples,
        DROP COLUMN next_action_at, DROP COLUMN step_started_at, DROP COLUMN step_index,
        DROP COLUMN plan, DROP COLUMN phase`);
  },
});
