import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * A page's "Referenced in" asks which issues link it from their description. Without an
 * index that was a JSON-path scan of every issue's description, capped at 100 rows. This
 * indexes the page ids each description links (every pageLink node's attrs.pageId, at
 * any depth) so the lookup is a GIN containment probe. The expression must stay
 * character for character the one LINKED_PAGE_IDS in services/references uses, or the
 * planner will not match it. Building the index reads every existing issue, which is the
 * backfill; afterwards Postgres keeps it in step on every write. Built concurrently so an
 * upgrade does not block writes to issues while it runs.
 */
export default changeset({
  id: '0024-work-issues-linked-pages-index',
  author: 'bemmoly',
  description: 'Index the pages each issue description links, for a page’s backlinks',
  contexts: ['*'],
  transactional: false,
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS issues_linked_pages_idx ON issues
        USING gin ((jsonb_path_query_array(description, '$.** ? (@.type == "pageLink").attrs.pageId')) jsonb_path_ops)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP INDEX CONCURRENTLY IF EXISTS issues_linked_pages_idx`);
  },
});
