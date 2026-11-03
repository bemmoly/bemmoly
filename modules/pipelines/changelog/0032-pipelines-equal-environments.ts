import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Environments are equal. A new environment needs no dev/staging/prod class, and each one
 * carries its own optional settings, all off until someone turns them on: who may deploy
 * (null is anyone whose role deploys), an approval rule of ordered steps (null deploys
 * directly), a deploy window (null is any time) and which versions may come here. The older
 * `class` and `protection` stay for the previous release and are dropped later.
 */
export default changeset({
  id: '0032-pipelines-equal-environments',
  author: 'bemmoly',
  description: 'Give environments optional deployers, approval rule, window and versions allowed',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE pipeline_environments
        ALTER COLUMN class DROP NOT NULL,
        ADD COLUMN deployers jsonb,
        ADD COLUMN approval_rule jsonb,
        ADD COLUMN deploy_window jsonb,
        ADD COLUMN versions_allowed text NOT NULL DEFAULT 'any'
          CHECK (versions_allowed IN ('any', 'passed_previous'))`);
  },
  down: async (ctx) => {
    // The previous release needs a class; one without is the least guarded.
    await ctx.exec(sql`UPDATE pipeline_environments SET class = 'dev' WHERE class IS NULL`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_environments
        DROP COLUMN versions_allowed,
        DROP COLUMN deploy_window,
        DROP COLUMN approval_rule,
        DROP COLUMN deployers,
        ALTER COLUMN class SET NOT NULL`);
  },
});
