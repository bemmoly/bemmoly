import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * What the Workflows list and the editor read back after a publish: when
 * the current version was published, and where each status sits on the
 * canvas, so a published workflow opens with the layout it was drawn in.
 * Existing workflows take their last update as the publish time; their
 * statuses have no position and are laid out by column, as before.
 */
export default changeset({
  id: '0021-work-workflow-publish-details',
  author: 'bemmoly',
  description: 'Add workflows.published_at and canvas positions to workflow_statuses',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`ALTER TABLE workflows ADD COLUMN published_at timestamptz`);
    await ctx.exec(sql`
      UPDATE workflows SET published_at = updated_at WHERE published_version > 0`);
    await ctx.exec(sql`
      ALTER TABLE workflow_statuses
        ADD COLUMN x real CONSTRAINT workflow_statuses_x_check CHECK (x >= 0),
        ADD COLUMN y real CONSTRAINT workflow_statuses_y_check CHECK (y >= 0)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`ALTER TABLE workflow_statuses DROP COLUMN y, DROP COLUMN x`);
    await ctx.exec(sql`ALTER TABLE workflows DROP COLUMN published_at`);
  },
});
