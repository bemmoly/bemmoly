import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * A service's pipeline setup, as the person chose it: start empty, from a built-in template
 * or from a repository file; keep it in Bemmoly or in the repository; how versions are
 * numbered. Every choice is null until made, and triggers start empty, so nothing runs on a
 * push until someone adds the trigger.
 */
export default changeset({
  id: '0034-pipelines-pipeline-setup',
  author: 'bemmoly',
  description: 'Record each service pipeline setup choice, with no triggers by default',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE pipeline_applications
        ADD COLUMN pipeline_start text
          CHECK (pipeline_start IN ('empty', 'template', 'repository')),
        ADD COLUMN pipeline_template text,
        ADD COLUMN pipeline_repository_file text,
        ADD COLUMN pipeline_store text CHECK (pipeline_store IN ('bemmoly', 'repository')),
        ADD COLUMN version_scheme text
          CHECK (version_scheme IN ('semver_commits', 'build_number', 'git_tag', 'commit')),
        ADD COLUMN pipeline_triggers jsonb NOT NULL DEFAULT '[]'::jsonb`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE pipeline_applications
        DROP COLUMN pipeline_triggers,
        DROP COLUMN version_scheme,
        DROP COLUMN pipeline_store,
        DROP COLUMN pipeline_repository_file,
        DROP COLUMN pipeline_template,
        DROP COLUMN pipeline_start`);
  },
});
