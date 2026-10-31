import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The repository file (.bemmoly/repository.yaml): an application's settings may now come from
 * its own file, the repository's central list or the repository's defaults. The catalog keeps
 * which, so its page can say. Discovery keeps the shared build it found for a folder, so the
 * pull request it opens can hold one repository file instead of a file per folder.
 */
export default changeset({
  id: '0027-pipelines-repository-file',
  author: 'bemmoly',
  description:
    'Record where an application’s settings come from, and shared builds discovery finds',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE pipeline_applications ADD COLUMN IF NOT EXISTS settings_sources jsonb`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_discovery_proposals ADD COLUMN IF NOT EXISTS shared_build jsonb`);
  },
  down: async (ctx) => {
    await ctx.exec(
      sql`ALTER TABLE pipeline_discovery_proposals DROP COLUMN IF EXISTS shared_build`,
    );
    await ctx.exec(sql`ALTER TABLE pipeline_applications DROP COLUMN IF EXISTS settings_sources`);
  },
});
