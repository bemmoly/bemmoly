import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The Yjs update log: one row per update the collab server persists, in
 * order. The docs.compact job folds a page's log into page_state once it
 * passes docs.compactThreshold and deletes the folded rows.
 */
export default changeset({
  id: '0004-docs-page-updates',
  author: 'bemmoly',
  description: 'Create page_updates, the Yjs update log',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE page_updates (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        page_id uuid NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
        seq bigint NOT NULL CHECK (seq > 0),
        update bytea NOT NULL,
        user_id uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX page_updates_page_seq_key ON page_updates (page_id, seq)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE page_updates`);
  },
});
