import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Who last changed a page's body, beside content_updated_at. updated_by also
 * moves on status, reviewer and title edits, so the Docs home's "edited by"
 * and a space's recent contributors read this instead. Existing pages take
 * their last updater, the closest record there is. The index serves a
 * space's contributors, newest edit first.
 */
export default changeset({
  id: '0015-docs-content-editor',
  author: 'bemmoly',
  description: 'Record who last edited each page body',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE pages
        ADD COLUMN content_updated_by uuid REFERENCES users (id) ON DELETE SET NULL`);
    await ctx.exec(sql`UPDATE pages SET content_updated_by = coalesce(updated_by, created_by)`);
    await ctx.exec(sql`
      CREATE INDEX pages_space_content_updated_idx
        ON pages (space_id, content_updated_at DESC) WHERE deleted_at IS NULL`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP INDEX pages_space_content_updated_idx`);
    await ctx.exec(sql`ALTER TABLE pages DROP COLUMN content_updated_by`);
  },
});
