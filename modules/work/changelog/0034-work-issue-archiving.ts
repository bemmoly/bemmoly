import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * An archived issue is finished with but kept: it leaves the board, the backlog, lists and
 * search, still opens by its key, and stays in reports, unlike a deleted one, which the trash
 * purges after thirty days. The index serves the archived list, which is small beside the
 * live issues, so it holds archived rows only.
 */
export default changeset({
  id: '0034-work-issue-archiving',
  author: 'bemmoly',
  description: 'Add archived_at to issues',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`ALTER TABLE issues ADD COLUMN archived_at timestamptz`);
    await ctx.exec(sql`
      CREATE INDEX issues_archived_idx ON issues (project_id, archived_at)
        WHERE archived_at IS NOT NULL AND deleted_at IS NULL`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP INDEX IF EXISTS issues_archived_idx`);
    await ctx.exec(sql`ALTER TABLE issues DROP COLUMN IF EXISTS archived_at`);
  },
});
