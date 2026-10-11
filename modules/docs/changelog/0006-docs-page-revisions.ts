import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Named or periodic snapshots for the version history and "compare with":
 * kind says what wrote it (a person naming it, the compaction job, a publish
 * or a restore). number counts up per page so the UI can say "v12".
 */
export default changeset({
  id: '0006-docs-page-revisions',
  author: 'bemmoly',
  description: 'Create page_revisions',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE page_revisions (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        page_id uuid NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
        number integer NOT NULL CHECK (number > 0),
        kind text NOT NULL DEFAULT 'periodic'
          CONSTRAINT page_revisions_kind_check
          CHECK (kind IN ('named', 'periodic', 'publish', 'restore')),
        label text CHECK (char_length(label) <= 120),
        title text NOT NULL DEFAULT '',
        snapshot jsonb NOT NULL,
        text text NOT NULL DEFAULT '',
        word_count integer NOT NULL DEFAULT 0 CHECK (word_count >= 0),
        author_ids uuid[] NOT NULL DEFAULT '{}',
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX page_revisions_page_number_key ON page_revisions (page_id, number)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE page_revisions`);
  },
});
