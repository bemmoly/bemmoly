import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Every job failure, kept: a job re-run until it passes no longer shows its failure, but
 * "this failure hit 14 services since 09:10" still needs to count it. One row per failed
 * attempt with its first error line and fingerprint (failure groups).
 */
export default changeset({
  id: '0012-pipelines-job-failures',
  author: 'bemmoly',
  description: 'Keep each failed job attempt with its first error line and fingerprint',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE pipeline_job_failures (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        job_id uuid NOT NULL REFERENCES pipeline_jobs (id) ON DELETE CASCADE,
        run_id uuid NOT NULL REFERENCES pipeline_runs (id) ON DELETE CASCADE,
        application_id uuid REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        attempt integer NOT NULL,
        line text NOT NULL,
        fingerprint text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_job_failures_fingerprint_idx
        ON pipeline_job_failures (fingerprint, created_at DESC)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_job_failures_created_brin
        ON pipeline_job_failures USING brin (created_at)`);
    await ctx.exec(
      sql`CREATE INDEX pipeline_job_failures_job_idx ON pipeline_job_failures (job_id)`,
    );
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE pipeline_job_failures`);
  },
});
