import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Polymorphic on target_kind so a later module adds a kind, not a table.
 * body is ProseMirror JSON with a plain text shadow for search, the same
 * two columns the Docs editor will reuse.
 */
export default changeset({
  id: '0011-work-comments',
  author: 'bemmoly',
  description: 'Create comments',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE comments (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        target_kind text NOT NULL
          CONSTRAINT comments_target_kind_check CHECK (target_kind IN ('issue')),
        target_id uuid NOT NULL,
        parent_id uuid REFERENCES comments (id) ON DELETE CASCADE,
        author_id uuid REFERENCES users (id) ON DELETE SET NULL,
        body jsonb NOT NULL,
        body_text text NOT NULL DEFAULT '',
        reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
        ai_run_id uuid,
        edited_at timestamptz,
        deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX comments_target_idx ON comments (target_kind, target_id, id)
        WHERE deleted_at IS NULL`);
    await ctx.exec(sql`CREATE INDEX comments_parent_id_idx ON comments (parent_id)`);
    await ctx.exec(sql`CREATE INDEX comments_author_id_idx ON comments (author_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE comments`);
  },
});
