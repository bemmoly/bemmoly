import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Page history brought in by an import: the earlier versions of a Confluence page become
 * revisions of kind 'imported', dated when they were made there. Widening the check is all it
 * takes; the previous minor never writes the new kind and reads it as any other revision.
 */
export default changeset({
  id: '0019-docs-imported-revisions',
  author: 'keerthi',
  description: 'Allow page revisions brought in by an import',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE page_revisions DROP CONSTRAINT page_revisions_kind_check,
        ADD CONSTRAINT page_revisions_kind_check
        CHECK (kind IN ('named', 'periodic', 'publish', 'restore', 'imported'))`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DELETE FROM page_revisions WHERE kind = 'imported'`);
    await ctx.exec(sql`
      ALTER TABLE page_revisions DROP CONSTRAINT page_revisions_kind_check,
        ADD CONSTRAINT page_revisions_kind_check
        CHECK (kind IN ('named', 'periodic', 'publish', 'restore'))`);
  },
});
