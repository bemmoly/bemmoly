import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Pushes, pull requests and schedules now start a run only for a service whose pipeline has
 * that trigger. Services whose pipeline was set up before triggers existed (no setup choice
 * recorded) were started by every push, pull request and schedule; they keep exactly that,
 * written down as triggers a person can now see and remove, so an update stops no delivery.
 * A fresh install has no services, so nothing is switched on by this.
 *
 * Jobs also record the environment they run against or deploy to, so a run's graph groups
 * them by environment and Pipelines can run a deploy step itself. Runs keep the pushed
 * commits' messages and the version they make, so versions can be numbered from commit
 * messages and a deploy step mid-run deploys the same version the run ends with.
 */
export default changeset({
  id: '0038-pipelines-triggers-and-job-environments',
  author: 'bemmoly',
  description: 'Keep earlier triggers explicit; record job environments and run versions',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      UPDATE pipeline_applications a
      SET pipeline_triggers = jsonb_build_array(
            jsonb_build_object('kind', 'push', 'branch', '*'),
            jsonb_build_object('kind', 'pull_request'))
          || coalesce((
               SELECT jsonb_agg(jsonb_build_object(
                 'kind', 'schedule', 'cron', s.cron, 'timeZone', s.time_zone) ORDER BY s.position)
               FROM pipeline_schedules s WHERE s.application_id = a.id), '[]'::jsonb)
      WHERE a.pipeline IS NOT NULL AND a.pipeline_start IS NULL
        AND a.pipeline_triggers = '[]'::jsonb`);
    await ctx.exec(sql`ALTER TABLE pipeline_jobs ADD COLUMN environment_key text`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_runs
        ADD COLUMN commit_messages text[] NOT NULL DEFAULT '{}',
        ADD COLUMN version text`);
  },
  down: async (ctx) => {
    // The triggers written above stay: the previous release does not read them.
    await ctx.exec(sql`ALTER TABLE pipeline_runs DROP COLUMN version, DROP COLUMN commit_messages`);
    await ctx.exec(sql`ALTER TABLE pipeline_jobs DROP COLUMN environment_key`);
  },
});
