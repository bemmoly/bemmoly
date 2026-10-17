import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The dispatcher's queue (architecture §5.1). A job is pending until the jobs it needs
 * finish, then ready; the dispatcher claims ready jobs per pool with SKIP LOCKED, picking
 * the team by deficit round robin and, within it, the highest priority class first.
 * `priority` is derived from the class so the claim's order is one index.
 */
export default changeset({
  id: '0005-pipelines-jobs',
  author: 'bemmoly',
  description: 'Create jobs, steps, log chunks and test timings',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE pipeline_jobs (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        run_id uuid NOT NULL REFERENCES pipeline_runs (id) ON DELETE CASCADE,
        application_id uuid REFERENCES pipeline_applications (id) ON DELETE SET NULL,
        key text NOT NULL,
        name text NOT NULL,
        kind text NOT NULL DEFAULT 'build' CHECK (kind IN (
          'detect', 'build', 'test', 'scan', 'publish', 'deploy', 'custom'
        )),
        needs text[] NOT NULL DEFAULT '{}',
        state text NOT NULL DEFAULT 'pending' CHECK (state IN (
          'pending', 'ready', 'claimed', 'running', 'passed', 'failed', 'cancelled', 'skipped'
        )),
        pool_id uuid REFERENCES pipeline_runner_pools (id) ON DELETE SET NULL,
        team_id uuid REFERENCES teams (id) ON DELETE SET NULL,
        priority_class text NOT NULL DEFAULT 'main' CHECK (priority_class IN (
          'rollback', 'deploy', 'main', 'pull_request', 'scheduled'
        )),
        priority smallint GENERATED ALWAYS AS (
          CASE priority_class
            WHEN 'rollback' THEN 0 WHEN 'deploy' THEN 1 WHEN 'main' THEN 2
            WHEN 'pull_request' THEN 3 ELSE 4
          END
        ) STORED,
        concurrency_key text,
        concurrency_limit integer NOT NULL DEFAULT 1 CHECK (concurrency_limit > 0),
        supersede_key text,
        shard_index integer,
        shard_total integer,
        attempt integer NOT NULL DEFAULT 1 CHECK (attempt > 0),
        max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
        timeout_minutes integer NOT NULL DEFAULT 60 CHECK (timeout_minutes > 0),
        runner_id uuid REFERENCES pipeline_runners (id) ON DELETE SET NULL,
        token_hash text,
        failure_summary text,
        ready_at timestamptz,
        claimed_at timestamptz,
        heartbeat_at timestamptz,
        started_at timestamptz,
        finished_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK ((shard_index IS NULL) = (shard_total IS NULL))
      )`);
    await ctx.exec(
      sql`CREATE UNIQUE INDEX pipeline_jobs_run_key_key ON pipeline_jobs (run_id, key)`,
    );
    await ctx.exec(sql`
      CREATE INDEX pipeline_jobs_dispatch_idx
        ON pipeline_jobs (pool_id, team_id, priority, ready_at)
        WHERE state = 'ready'`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_jobs_concurrency_idx ON pipeline_jobs (concurrency_key, state)
        WHERE concurrency_key IS NOT NULL AND state IN ('ready', 'claimed', 'running')`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_jobs_heartbeat_idx ON pipeline_jobs (heartbeat_at)
        WHERE state IN ('claimed', 'running')`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_jobs_supersede_idx ON pipeline_jobs (supersede_key)
        WHERE supersede_key IS NOT NULL AND state IN ('pending', 'ready', 'claimed', 'running')`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_jobs_application_idx ON pipeline_jobs (application_id, created_at DESC)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_jobs_created_brin ON pipeline_jobs USING brin (created_at)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_steps (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        job_id uuid NOT NULL REFERENCES pipeline_jobs (id) ON DELETE CASCADE,
        position integer NOT NULL CHECK (position >= 0),
        name text NOT NULL,
        image text,
        run text,
        uses text,
        locked boolean NOT NULL DEFAULT false,
        state text NOT NULL DEFAULT 'pending' CHECK (state IN (
          'pending', 'running', 'passed', 'failed', 'cancelled', 'skipped'
        )),
        exit_code integer,
        first_line integer,
        line_count integer,
        started_at timestamptz,
        finished_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_steps_job_position_key ON pipeline_steps (job_id, position)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_log_chunks (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        job_id uuid NOT NULL REFERENCES pipeline_jobs (id) ON DELETE CASCADE,
        step_id uuid REFERENCES pipeline_steps (id) ON DELETE SET NULL,
        seq integer NOT NULL CHECK (seq >= 0),
        first_line integer NOT NULL CHECK (first_line >= 1),
        line_count integer NOT NULL CHECK (line_count >= 0),
        byte_size integer NOT NULL CHECK (byte_size >= 0),
        object_key text NOT NULL,
        has_error boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_log_chunks_job_seq_key ON pipeline_log_chunks (job_id, seq)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_log_chunks_line_idx ON pipeline_log_chunks (job_id, first_line)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_test_timings (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        test_file text NOT NULL,
        duration_ms integer NOT NULL CHECK (duration_ms >= 0),
        samples integer NOT NULL DEFAULT 1,
        recent_outcomes text NOT NULL DEFAULT '' CHECK (recent_outcomes ~ '^[pf]{0,50}$'),
        last_failed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_test_timings_file_key
        ON pipeline_test_timings (application_id, test_file)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE pipeline_test_timings`);
    await ctx.exec(sql`DROP TABLE pipeline_log_chunks`);
    await ctx.exec(sql`DROP TABLE pipeline_steps`);
    await ctx.exec(sql`DROP TABLE pipeline_jobs`);
  },
});
