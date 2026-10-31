import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Build machines Pipelines starts itself. A pool keeps how it starts them (a Cloud Build
 * project, region, image and service account) and the last error starting one. Each machine
 * started for one job is a row: the job it is for, the hash of its one-time registration
 * token, the cloud's id for it, its log, and when a sweep last asked the cloud about it (a
 * short lease, so two servers never check one machine at once). A job waiting for its
 * machine points at that row, and so does the runner the machine registers, so the token
 * works for that one job only.
 */
export default changeset({
  id: '0023-pipelines-build-machines',
  author: 'bemmoly',
  description: 'Record build machines started for one job and how a pool starts them',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE pipeline_runner_pools
        ADD COLUMN config jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN last_error text`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_runner_launches (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        pool_id uuid NOT NULL REFERENCES pipeline_runner_pools (id) ON DELETE CASCADE,
        job_id uuid NOT NULL REFERENCES pipeline_jobs (id) ON DELETE CASCADE,
        state text NOT NULL DEFAULT 'starting'
          CHECK (state IN ('starting', 'running', 'finished', 'failed', 'cancelled')),
        token_hash text NOT NULL,
        token_expires_at timestamptz NOT NULL,
        external_ref text,
        log_url text,
        error text,
        registered_at timestamptz,
        checked_at timestamptz,
        finished_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_runner_launches_token_key
        ON pipeline_runner_launches (token_hash)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_runner_launches_live_idx ON pipeline_runner_launches (pool_id, state)
        WHERE state IN ('starting', 'running')`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_runner_launches_job_idx
        ON pipeline_runner_launches (job_id, created_at DESC)`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_jobs
        ADD COLUMN launch_id uuid REFERENCES pipeline_runner_launches (id) ON DELETE SET NULL`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_runners
        ADD COLUMN launch_id uuid REFERENCES pipeline_runner_launches (id) ON DELETE SET NULL`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`ALTER TABLE pipeline_runners DROP COLUMN launch_id`);
    await ctx.exec(sql`ALTER TABLE pipeline_jobs DROP COLUMN launch_id`);
    await ctx.exec(sql`DROP TABLE pipeline_runner_launches`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_runner_pools
        DROP COLUMN config,
        DROP COLUMN last_error`);
  },
});
