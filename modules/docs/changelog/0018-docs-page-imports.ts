import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * One row per file import that ran with an idempotency key, written in the transaction that
 * creates its pages. A retried import job finds the row and returns the pages it already
 * made instead of writing them again. A new table, so the previous minor never sees it.
 */
export default changeset({
  id: '0018-docs-page-imports',
  author: 'bemmoly',
  description: 'Create page_imports so a retried import job does not duplicate pages',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE page_imports (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        space_id uuid NOT NULL REFERENCES spaces (id) ON DELETE CASCADE,
        idempotency_key text NOT NULL,
        pages jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX page_imports_space_key ON page_imports (space_id, idempotency_key)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE page_imports`);
  },
});
