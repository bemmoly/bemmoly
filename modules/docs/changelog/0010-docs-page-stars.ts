import { changeset, sql } from '@bemmoly/core/changelog';

/** Per-user starred pages, newest first on the Docs home. */
export default changeset({
  id: '0010-docs-page-stars',
  author: 'bemmoly',
  description: 'Create page_stars',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE page_stars (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        page_id uuid NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX page_stars_user_page_key ON page_stars (user_id, page_id)`);
    await ctx.exec(sql`
      CREATE INDEX page_stars_user_created_idx ON page_stars (user_id, created_at DESC, id DESC)`);
    await ctx.exec(sql`CREATE INDEX page_stars_page_id_idx ON page_stars (page_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE page_stars`);
  },
});
