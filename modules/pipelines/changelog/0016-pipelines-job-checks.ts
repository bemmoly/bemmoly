import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Each job's check run on the code host, so the next state change updates the same check
 * instead of adding another (architecture §8: one report per job state change); and whether
 * a run comes from a fork, whose jobs get no secrets (§20).
 */
export default changeset({
  id: '0016-pipelines-job-checks',
  author: 'bemmoly',
  description: "Keep each job's check run id and whether a run comes from a fork",
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`ALTER TABLE pipeline_jobs ADD COLUMN check_external_id text`);
    await ctx.exec(
      sql`ALTER TABLE pipeline_runs ADD COLUMN from_fork boolean NOT NULL DEFAULT false`,
    );
  },
  down: async (ctx) => {
    await ctx.exec(sql`ALTER TABLE pipeline_runs DROP COLUMN from_fork`);
    await ctx.exec(sql`ALTER TABLE pipeline_jobs DROP COLUMN check_external_id`);
  },
});
