import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Adopting services that already run. Adopting one records the image it runs as release zero,
 * so the first deploy from Pipelines rolls forward from it and a roll back can return to it.
 * That release was built neither by Pipelines' runners nor registered by another CI, so it
 * says it was adopted.
 */
export default changeset({
  id: '0029-pipelines-adopt-copy',
  author: 'bemmoly',
  description: 'Let a release say it was adopted from a service that already ran',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE pipeline_releases
        DROP CONSTRAINT IF EXISTS pipeline_releases_source_check,
        ADD CONSTRAINT pipeline_releases_source_check
          CHECK (source IN ('runners', 'external', 'adopted'))`);
  },
  down: async (ctx) => {
    // The previous release knows no adopted source; the nearest is a release built elsewhere.
    await ctx.exec(sql`UPDATE pipeline_releases SET source = 'external' WHERE source = 'adopted'`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_releases
        DROP CONSTRAINT pipeline_releases_source_check,
        ADD CONSTRAINT pipeline_releases_source_check CHECK (source IN ('runners', 'external'))`);
  },
});
