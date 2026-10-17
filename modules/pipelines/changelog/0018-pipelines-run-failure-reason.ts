import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Why a run failed before any job could start: an application.yaml that does not read, a
 * pipeline that does not resolve. Such a run has no jobs to carry a failure summary, so the
 * reason lives on the run, for Runs, the run page and the commit's check.
 */
export default changeset({
  id: '0018-pipelines-run-failure-reason',
  author: 'bemmoly',
  description: 'Keep why a run failed before any job started',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`ALTER TABLE pipeline_runs ADD COLUMN failure_reason text`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`ALTER TABLE pipeline_runs DROP COLUMN failure_reason`);
  },
});
