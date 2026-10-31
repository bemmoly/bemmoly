import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Adopting services that already run. Adopting one records the image it runs as release zero,
 * so the first deploy from Pipelines rolls forward from it and a roll back can return to it.
 * That release was built neither by Pipelines' runners nor registered by another CI, so it
 * says it was adopted.
 *
 * Copying configuration to another environment may leave a secret's value behind, so a
 * secret row may now hold neither a value nor a place in the store: it waits for someone to
 * set one, and a deploy there stops until they do. A row still never holds both.
 */
export default changeset({
  id: '0029-pipelines-adopt-copy',
  author: 'bemmoly',
  description: 'Let a release say it was adopted, and a copied secret wait for its value',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE pipeline_releases
        DROP CONSTRAINT IF EXISTS pipeline_releases_source_check,
        ADD CONSTRAINT pipeline_releases_source_check
          CHECK (source IN ('runners', 'external', 'adopted'))`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_variables
        DROP CONSTRAINT IF EXISTS pipeline_variables_check,
        ADD CONSTRAINT pipeline_variables_value_or_ref CHECK (
          NOT (value IS NOT NULL AND secret_ref IS NOT NULL)
          AND (kind = 'secret' OR value IS NOT NULL))`);
  },
  down: async (ctx) => {
    // The previous release cannot hold a secret without a value; it is set again by hand.
    await ctx.exec(sql`
      DELETE FROM pipeline_variables WHERE value IS NULL AND secret_ref IS NULL`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_variables
        DROP CONSTRAINT pipeline_variables_value_or_ref,
        ADD CONSTRAINT pipeline_variables_check CHECK ((value IS NULL) <> (secret_ref IS NULL))`);
    // The previous release knows no adopted source; the nearest is a release built elsewhere.
    await ctx.exec(sql`UPDATE pipeline_releases SET source = 'external' WHERE source = 'adopted'`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_releases
        DROP CONSTRAINT pipeline_releases_source_check,
        ADD CONSTRAINT pipeline_releases_source_check CHECK (source IN ('runners', 'external'))`);
  },
});
