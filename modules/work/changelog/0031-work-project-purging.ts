import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * A project with too many issues to delete in one transaction is marked and handed to a
 * job that deletes its issues in batches. While marked it is gone to every reader.
 */
export default changeset({
  id: '0031-work-project-purging',
  author: 'bemmoly',
  description: 'Add projects.purging_at for deletes the purge job finishes',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`ALTER TABLE projects ADD COLUMN purging_at timestamptz`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`ALTER TABLE projects DROP COLUMN purging_at`);
  },
});
