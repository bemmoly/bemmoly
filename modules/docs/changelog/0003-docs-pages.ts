import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * A page tree is parent_id plus a materialized path of ancestor ids
 * ("/<root>/<child>/"), so a subtree is one prefix scan and a move rewrites
 * one prefix. position is a lexorank among siblings, as Work ranks issues.
 * snapshot and text are the ProseMirror JSON and its plain-text shadow the
 * collab hook extracts; tldr regenerates only when tldr_source_hash no longer
 * matches the text. pg_trgm is a trusted extension (see Work's issues).
 */
export default changeset({
  id: '0003-docs-pages',
  author: 'bemmoly',
  description: 'Create pages with tree, rank, search and trigram indexes',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await ctx.exec(sql`
      CREATE TABLE pages (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        space_id uuid NOT NULL REFERENCES spaces (id) ON DELETE CASCADE,
        parent_id uuid REFERENCES pages (id) ON DELETE CASCADE,
        position text NOT NULL CHECK (position ~ '^[a-z]*[b-z]$'),
        path text NOT NULL CHECK (path ~ '^/([0-9a-f-]{36}/)+$'),
        title text NOT NULL DEFAULT '' CHECK (char_length(title) <= 500),
        icon text,
        status text NOT NULL DEFAULT 'draft'
          CONSTRAINT pages_status_check
          CHECK (status IN ('draft', 'in_review', 'published', 'archived')),
        owner_id uuid REFERENCES users (id) ON DELETE SET NULL,
        reviewers uuid[] NOT NULL DEFAULT '{}',
        template_id uuid REFERENCES templates (id) ON DELETE SET NULL,
        snapshot jsonb,
        text text NOT NULL DEFAULT '',
        search_vector tsvector,
        tldr text,
        tldr_source_hash text,
        word_count integer NOT NULL DEFAULT 0 CHECK (word_count >= 0),
        version integer NOT NULL DEFAULT 1 CHECK (version > 0),
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
        published_at timestamptz,
        content_updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        deleted_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pages_not_own_parent_check CHECK (parent_id IS NULL OR parent_id <> id)
      )`);
    await ctx.exec(sql`
      CREATE INDEX pages_tree_idx ON pages (space_id, parent_id, position, id)
        WHERE deleted_at IS NULL`);
    await ctx.exec(sql`
      CREATE INDEX pages_path_idx ON pages (path text_pattern_ops) WHERE deleted_at IS NULL`);
    await ctx.exec(sql`CREATE INDEX pages_parent_id_idx ON pages (parent_id)`);
    await ctx.exec(sql`
      CREATE INDEX pages_recent_idx ON pages (updated_at DESC, id DESC) WHERE deleted_at IS NULL`);
    await ctx.exec(sql`
      CREATE INDEX pages_trash_idx ON pages (space_id, deleted_at DESC)
        WHERE deleted_at IS NOT NULL`);
    await ctx.exec(sql`
      CREATE INDEX pages_owner_id_idx ON pages (owner_id) WHERE deleted_at IS NULL`);
    await ctx.exec(sql`CREATE INDEX pages_reviewers_idx ON pages USING gin (reviewers)`);
    await ctx.exec(sql`CREATE INDEX pages_template_id_idx ON pages (template_id)`);
    await ctx.exec(sql`CREATE INDEX pages_search_vector_idx ON pages USING gin (search_vector)`);
    await ctx.exec(sql`CREATE INDEX pages_title_trgm_idx ON pages USING gin (title gin_trgm_ops)`);
    await ctx.exec(sql`
      ALTER TABLE spaces
        ADD CONSTRAINT spaces_home_page_id_fkey
        FOREIGN KEY (home_page_id) REFERENCES pages (id) ON DELETE SET NULL`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`ALTER TABLE spaces DROP CONSTRAINT spaces_home_page_id_fkey`);
    await ctx.exec(sql`DROP TABLE pages`);
  },
});
