import { changeset, sql } from '@bemmoly/core/changelog';

/** "Blocked by" on a card is the inverse of a blocks row, never a second row. */
export default changeset({
  id: '0007-work-issue-links',
  author: 'bemmoly',
  description: 'Create issue_links',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE issue_links (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        source_id uuid NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
        target_id uuid NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
        kind text NOT NULL
          CONSTRAINT issue_links_kind_check CHECK (kind IN ('blocks', 'relates', 'duplicates')),
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT issue_links_not_self_check CHECK (source_id <> target_id)
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX issue_links_source_target_kind_key
        ON issue_links (source_id, target_id, kind)`);
    await ctx.exec(sql`CREATE INDEX issue_links_target_id_idx ON issue_links (target_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE issue_links`);
  },
});
