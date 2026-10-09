import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The board view and the metrics endpoint key their cached numbers on the
 * latest change to a project's issues. Without this index that max() reads
 * every issue of the project on each board load; with it, one index entry.
 * Deleted issues stay in it, since a deletion changes the numbers too. Built
 * concurrently so an upgrade does not block writes to issues while it runs.
 */
export default changeset({
  id: '0022-work-issues-updated-index',
  author: 'bemmoly',
  description: 'Index issues by project and last update for the board metrics cache key',
  contexts: ['*'],
  transactional: false,
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS issues_project_updated_idx
        ON issues (project_id, updated_at)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP INDEX CONCURRENTLY IF EXISTS issues_project_updated_idx`);
  },
});
