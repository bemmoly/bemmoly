import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Running work (architecture §5, §6, §8). Webhook deliveries land in a durable inbox. A run
 * is one commit's (or one request's) pipeline; jobs are its nodes and the dispatcher's queue;
 * steps are the containers a job runs. Pools hold runners and each team's fair-share weight.
 *
 * Jobs and steps are not partitioned yet: their indexes are partial on the live states, so
 * the dispatcher's claim stays an index read however much history piles up, and partitioning
 * by month (with a job that creates partitions ahead) is a later changeset.
 */
export default changeset({
  id: '0004-pipelines-running',
  author: 'bemmoly',
  description: 'Create the webhook inbox, runner pools, runners, runs, jobs, steps and logs',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE pipeline_webhook_inbox (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        provider text NOT NULL DEFAULT 'github',
        delivery_id text NOT NULL,
        event text NOT NULL,
        repository_full_name text,
        payload jsonb NOT NULL,
        state text NOT NULL DEFAULT 'pending'
          CHECK (state IN ('pending', 'processing', 'done', 'failed', 'ignored')),
        attempts integer NOT NULL DEFAULT 0,
        last_error text,
        received_at timestamptz NOT NULL DEFAULT now(),
        processed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_webhook_inbox_delivery_key
        ON pipeline_webhook_inbox (provider, delivery_id)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_webhook_inbox_pending_idx
        ON pipeline_webhook_inbox (repository_full_name, received_at)
        WHERE state IN ('pending', 'processing')`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_runner_pools (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        key text NOT NULL CHECK (key ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
        name text NOT NULL,
        hosting text NOT NULL DEFAULT 'kubernetes'
          CHECK (hosting IN ('kubernetes', 'vm', 'local', 'cloud-build', 'codebuild')),
        location text,
        labels text[] NOT NULL DEFAULT '{}',
        min_runners integer NOT NULL DEFAULT 0 CHECK (min_runners >= 0),
        max_runners integer NOT NULL DEFAULT 10 CHECK (max_runners >= min_runners),
        warm_runners integer NOT NULL DEFAULT 0 CHECK (warm_runners >= 0),
        cloud_account_id uuid REFERENCES cloud_accounts (id) ON DELETE SET NULL,
        token_hash text,
        token_rotated_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_runner_pools_key_key ON pipeline_runner_pools (key)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_team_shares (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        pool_id uuid NOT NULL REFERENCES pipeline_runner_pools (id) ON DELETE CASCADE,
        team_id uuid NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
        weight integer NOT NULL DEFAULT 1 CHECK (weight > 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_team_shares_key ON pipeline_team_shares (pool_id, team_id)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_runners (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        pool_id uuid NOT NULL REFERENCES pipeline_runner_pools (id) ON DELETE CASCADE,
        name text NOT NULL,
        version text,
        state text NOT NULL DEFAULT 'idle' CHECK (state IN ('idle', 'busy', 'draining', 'gone')),
        labels text[] NOT NULL DEFAULT '{}',
        current_job_id uuid,
        last_heartbeat_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_runners_pool_idx ON pipeline_runners (pool_id, state)
        WHERE state <> 'gone'`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_runs (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        number bigint GENERATED ALWAYS AS IDENTITY,
        repository_id uuid REFERENCES pipeline_repositories (id) ON DELETE SET NULL,
        trigger text NOT NULL CHECK (trigger IN (
          'push', 'pull_request', 'merge_group', 'schedule', 'manual', 'external', 'rerun'
        )),
        ref text NOT NULL,
        commit_sha text NOT NULL,
        title text NOT NULL,
        pull_request integer,
        issue_key text,
        author_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
        author_login text,
        team_id uuid REFERENCES teams (id) ON DELETE SET NULL,
        state text NOT NULL DEFAULT 'queued' CHECK (state IN (
          'queued', 'running', 'waiting', 'passed', 'failed', 'cancelled', 'skipped'
        )),
        priority_class text NOT NULL DEFAULT 'main' CHECK (priority_class IN (
          'rollback', 'deploy', 'main', 'pull_request', 'scheduled'
        )),
        executor text NOT NULL DEFAULT 'runners' CHECK (executor IN ('runners', 'external')),
        external_url text,
        supersede_key text,
        superseded_by_run_id uuid REFERENCES pipeline_runs (id) ON DELETE SET NULL,
        rerun_of_run_id uuid REFERENCES pipeline_runs (id) ON DELETE SET NULL,
        idempotency_key text,
        resolved_spec jsonb,
        started_at timestamptz,
        finished_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE UNIQUE INDEX pipeline_runs_number_key ON pipeline_runs (number)`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_runs_idempotency_key ON pipeline_runs (idempotency_key)
        WHERE idempotency_key IS NOT NULL`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_runs_repository_idx ON pipeline_runs (repository_id, created_at DESC)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_runs_author_idx ON pipeline_runs (author_user_id, created_at DESC)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_runs_team_idx ON pipeline_runs (team_id, created_at DESC)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_runs_live_idx ON pipeline_runs (state, created_at)
        WHERE state IN ('queued', 'running', 'waiting')`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_runs_supersede_idx ON pipeline_runs (supersede_key, created_at DESC)
        WHERE supersede_key IS NOT NULL`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_runs_created_brin ON pipeline_runs USING brin (created_at)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_run_applications (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        run_id uuid NOT NULL REFERENCES pipeline_runs (id) ON DELETE CASCADE,
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_run_applications_key
        ON pipeline_run_applications (run_id, application_id)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_run_applications_application_idx
        ON pipeline_run_applications (application_id, created_at DESC)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE pipeline_run_applications`);
    await ctx.exec(sql`DROP TABLE pipeline_runs`);
    await ctx.exec(sql`DROP TABLE pipeline_runners`);
    await ctx.exec(sql`DROP TABLE pipeline_team_shares`);
    await ctx.exec(sql`DROP TABLE pipeline_runner_pools`);
    await ctx.exec(sql`DROP TABLE pipeline_webhook_inbox`);
  },
});
