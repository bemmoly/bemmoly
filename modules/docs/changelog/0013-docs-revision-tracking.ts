import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * What the periodic revision needs to know about edits since the last
 * revision: who made them (the next revision's author_ids) and when the first
 * of them landed (a revision is due once that is 30 minutes old). Every
 * revision clears both. The id index serves the history list's keyset.
 */
export default changeset({
  id: '0013-docs-revision-tracking',
  author: 'bemmoly',
  description: 'Track edits since the last page revision',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE pages
        ADD COLUMN revision_editor_ids uuid[] NOT NULL DEFAULT '{}',
        ADD COLUMN revision_pending_since timestamptz`);
    await ctx.exec(sql`
      CREATE INDEX page_revisions_page_id_idx ON page_revisions (page_id, id DESC)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP INDEX page_revisions_page_id_idx`);
    await ctx.exec(sql`
      ALTER TABLE pages DROP COLUMN revision_pending_since, DROP COLUMN revision_editor_ids`);
  },
});
