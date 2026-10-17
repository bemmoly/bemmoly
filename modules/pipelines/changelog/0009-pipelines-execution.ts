import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * What running pipelines needs beyond the queue (architecture §5, §6, §7, §18):
 *
 * - Run numbers per application ("checkout-api run 1,284"), assigned on insert from a
 *   counter row per application, so concurrent inserts never collide and callers that
 *   insert without a number (the demo seed, bulk imports) still get one.
 * - The application's pipeline definition as last read from its repository, with its
 *   schedules materialised so the scheduler reads one index for what is due.
 * - Runner and job tokens (hashes only), the dispatcher's fair-share state per pool, the
 *   matrix cell and failure fingerprint per job.
 * - Tests that ever failed, by file and name, with their recent outcomes on the default
 *   branch, flakiness and quarantine; and each failure, for flaky detection and grouping.
 * - Artifacts a job keeps.
 */
export default changeset({
  id: '0009-pipelines-execution',
  author: 'bemmoly',
  description:
    'Add per-application run numbers, pipeline definitions, schedules, tokens, test history and artifacts',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE pipeline_applications
        ADD COLUMN pipeline jsonb,
        ADD COLUMN pipeline_source text CHECK (pipeline_source IN ('repository', 'catalog')),
        ADD COLUMN pipeline_commit_sha text`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_runs
        ADD COLUMN application_id uuid REFERENCES pipeline_applications (id) ON DELETE SET NULL,
        ADD COLUMN inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN variables jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        ADD COLUMN cancel_reason text`);
    await ctx.exec(sql`
      UPDATE pipeline_runs r SET application_id = (
        SELECT ra.application_id FROM pipeline_run_applications ra
        WHERE ra.run_id = r.id ORDER BY ra.created_at, ra.id LIMIT 1)`);
    await ctx.exec(sql`ALTER TABLE pipeline_runs ALTER COLUMN number DROP IDENTITY`);
    await ctx.exec(sql`DROP INDEX pipeline_runs_number_key`);
    await ctx.exec(sql`
      UPDATE pipeline_runs r SET number = n.number
      FROM (SELECT id, row_number() OVER (PARTITION BY application_id ORDER BY created_at, id)
              AS number FROM pipeline_runs) n
      WHERE n.id = r.id`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_runs_application_number_key
        ON pipeline_runs (application_id, number) NULLS NOT DISTINCT`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_runs_application_idx
        ON pipeline_runs (application_id, created_at DESC)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_run_counters (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        application_id uuid REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        last_number bigint NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_run_counters_application_key
        ON pipeline_run_counters (application_id) NULLS NOT DISTINCT`);
    await ctx.exec(sql`
      INSERT INTO pipeline_run_counters (application_id, last_number)
      SELECT application_id, max(number) FROM pipeline_runs GROUP BY application_id`);
    await ctx.exec(sql`
      CREATE FUNCTION pipeline_runs_assign_number() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.number IS NULL THEN
          INSERT INTO pipeline_run_counters (application_id, last_number)
          VALUES (NEW.application_id, 1)
          ON CONFLICT (application_id) DO UPDATE
            SET last_number = pipeline_run_counters.last_number + 1, updated_at = now()
          RETURNING last_number INTO NEW.number;
        END IF;
        RETURN NEW;
      END $$`);
    await ctx.exec(sql`
      CREATE TRIGGER pipeline_runs_number BEFORE INSERT ON pipeline_runs
        FOR EACH ROW EXECUTE FUNCTION pipeline_runs_assign_number()`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_schedules (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        position integer NOT NULL CHECK (position >= 0),
        cron text NOT NULL,
        time_zone text NOT NULL DEFAULT 'UTC',
        ref text,
        inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
        next_run_at timestamptz,
        last_run_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_schedules_position_key
        ON pipeline_schedules (application_id, position)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_schedules_due_idx ON pipeline_schedules (next_run_at)
        WHERE next_run_at IS NOT NULL`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_runner_pools
        ADD COLUMN dispatch_state jsonb NOT NULL DEFAULT '{}'::jsonb`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_runner_pools_token_key ON pipeline_runner_pools (token_hash)
        WHERE token_hash IS NOT NULL`);
    await ctx.exec(sql`ALTER TABLE pipeline_runners ADD COLUMN token_hash text`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_runners_token_key ON pipeline_runners (token_hash)
        WHERE token_hash IS NOT NULL`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_jobs
        ADD COLUMN matrix jsonb,
        ADD COLUMN steps_spec jsonb,
        ADD COLUMN token_expires_at timestamptz,
        ADD COLUMN failure_fingerprint text,
        ADD COLUMN failure_line text,
        ADD COLUMN test_summary jsonb,
        ADD COLUMN image_digests jsonb`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_jobs_fingerprint_idx
        ON pipeline_jobs (failure_fingerprint, finished_at DESC)
        WHERE failure_fingerprint IS NOT NULL`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_jobs_run_idx ON pipeline_jobs (run_id, state)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_tests (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        file text NOT NULL,
        name text NOT NULL,
        recent_outcomes text NOT NULL DEFAULT '' CHECK (recent_outcomes ~ '^[pf]{0,50}$'),
        flaky text CHECK (flaky IN ('retry', 'intermittent')),
        flaky_since timestamptz,
        last_failed_at timestamptz,
        quarantined_at timestamptz,
        quarantined_by uuid REFERENCES users (id) ON DELETE SET NULL,
        quarantine_reason text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_tests_name_key ON pipeline_tests (application_id, file, name)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_tests_flaky_idx ON pipeline_tests (application_id, flaky_since DESC)
        WHERE flaky IS NOT NULL OR quarantined_at IS NOT NULL`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_test_failures (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        test_id uuid NOT NULL REFERENCES pipeline_tests (id) ON DELETE CASCADE,
        job_id uuid NOT NULL REFERENCES pipeline_jobs (id) ON DELETE CASCADE,
        run_id uuid NOT NULL REFERENCES pipeline_runs (id) ON DELETE CASCADE,
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        commit_sha text NOT NULL,
        line integer,
        message text,
        fingerprint text,
        quarantined boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_test_failures_commit_idx
        ON pipeline_test_failures (application_id, commit_sha)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_test_failures_job_idx ON pipeline_test_failures (job_id)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_test_failures_fingerprint_idx
        ON pipeline_test_failures (fingerprint, created_at DESC) WHERE fingerprint IS NOT NULL`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_test_failures_created_brin
        ON pipeline_test_failures USING brin (created_at)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_job_artifacts (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        job_id uuid NOT NULL REFERENCES pipeline_jobs (id) ON DELETE CASCADE,
        name text NOT NULL,
        object_key text NOT NULL,
        size bigint NOT NULL CHECK (size >= 0),
        content_type text NOT NULL DEFAULT 'application/octet-stream',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_job_artifacts_name_key ON pipeline_job_artifacts (job_id, name)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE pipeline_job_artifacts`);
    await ctx.exec(sql`DROP TABLE pipeline_test_failures`);
    await ctx.exec(sql`DROP TABLE pipeline_tests`);
    await ctx.exec(sql`DROP INDEX pipeline_jobs_run_idx`);
    await ctx.exec(sql`DROP INDEX pipeline_jobs_fingerprint_idx`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_jobs
        DROP COLUMN image_digests, DROP COLUMN test_summary, DROP COLUMN failure_line,
        DROP COLUMN failure_fingerprint, DROP COLUMN token_expires_at, DROP COLUMN steps_spec,
        DROP COLUMN matrix`);
    await ctx.exec(sql`DROP INDEX pipeline_runners_token_key`);
    await ctx.exec(sql`ALTER TABLE pipeline_runners DROP COLUMN token_hash`);
    await ctx.exec(sql`DROP INDEX pipeline_runner_pools_token_key`);
    await ctx.exec(sql`ALTER TABLE pipeline_runner_pools DROP COLUMN dispatch_state`);
    await ctx.exec(sql`DROP TABLE pipeline_schedules`);
    await ctx.exec(sql`DROP TRIGGER pipeline_runs_number ON pipeline_runs`);
    await ctx.exec(sql`DROP FUNCTION pipeline_runs_assign_number()`);
    await ctx.exec(sql`DROP TABLE pipeline_run_counters`);
    await ctx.exec(sql`DROP INDEX pipeline_runs_application_idx`);
    await ctx.exec(sql`DROP INDEX pipeline_runs_application_number_key`);
    await ctx.exec(sql`
      UPDATE pipeline_runs r SET number = n.number
      FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS number FROM pipeline_runs) n
      WHERE n.id = r.id`);
    await ctx.exec(
      sql`ALTER TABLE pipeline_runs ALTER COLUMN number ADD GENERATED ALWAYS AS IDENTITY`,
    );
    await ctx.exec(sql`
      SELECT setval(pg_get_serial_sequence('pipeline_runs', 'number'),
        coalesce((SELECT max(number) FROM pipeline_runs), 0) + 1, false)`);
    await ctx.exec(sql`CREATE UNIQUE INDEX pipeline_runs_number_key ON pipeline_runs (number)`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_runs
        DROP COLUMN cancel_reason, DROP COLUMN created_by, DROP COLUMN variables,
        DROP COLUMN inputs, DROP COLUMN application_id`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_applications
        DROP COLUMN pipeline_commit_sha, DROP COLUMN pipeline_source, DROP COLUMN pipeline`);
  },
});
