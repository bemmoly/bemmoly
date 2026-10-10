import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The compacted Yjs document of a page: the collab server loads state, then
 * applies every page_updates row past folded_seq.
 */
export default changeset({
  id: '0005-docs-page-state',
  author: 'bemmoly',
  description: 'Create page_state, the compacted Yjs document',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE page_state (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        page_id uuid NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
        state bytea NOT NULL,
        folded_seq bigint NOT NULL DEFAULT 0 CHECK (folded_seq >= 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE UNIQUE INDEX page_state_page_id_key ON page_state (page_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE page_state`);
  },
});
