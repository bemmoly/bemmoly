import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * A page's cover: the id of one of the drawn patterns the editor offers, or
 * null for no cover. Uploads come later and will need their own column; the
 * pattern id stays a short text so a new pattern is a client change only.
 * Nullable with no default, so the previous minor reads and writes pages as
 * before.
 */
export default changeset({
  id: '0016-docs-page-cover',
  author: 'bemmoly',
  description: 'Store the drawn cover pattern chosen for a page',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`ALTER TABLE pages ADD COLUMN cover text`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`ALTER TABLE pages DROP COLUMN cover`);
  },
});
