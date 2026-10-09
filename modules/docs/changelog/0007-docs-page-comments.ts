import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Inline and page-level comments. anchor holds the Yjs relative position and
 * the quoted text so an inline comment survives edits; null is a page-level
 * comment. Threads are one level deep through parent_id. ai_suggestion is the
 * fix the "Apply fix" button applies.
 */
export default changeset({
  id: '0007-docs-page-comments',
  author: 'bemmoly',
  description: 'Create page_comments',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE page_comments (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        page_id uuid NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
        parent_id uuid REFERENCES page_comments (id) ON DELETE CASCADE,
        author_id uuid REFERENCES users (id) ON DELETE SET NULL,
        body jsonb NOT NULL,
        body_text text NOT NULL DEFAULT '',
        anchor jsonb,
        ai_suggestion jsonb,
        resolved_at timestamptz,
        resolved_by uuid REFERENCES users (id) ON DELETE SET NULL,
        edited_at timestamptz,
        deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX page_comments_page_idx ON page_comments (page_id, created_at, id)
        WHERE deleted_at IS NULL`);
    await ctx.exec(sql`
      CREATE INDEX page_comments_open_idx ON page_comments (page_id)
        WHERE deleted_at IS NULL AND resolved_at IS NULL AND parent_id IS NULL`);
    await ctx.exec(sql`CREATE INDEX page_comments_parent_id_idx ON page_comments (parent_id)`);
    await ctx.exec(sql`CREATE INDEX page_comments_author_id_idx ON page_comments (author_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE page_comments`);
  },
});
