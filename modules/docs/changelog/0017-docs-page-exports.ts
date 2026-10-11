import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * PDF exports rendered in the background. One row per request, found again by its
 * idempotency key, so a retried request or a double click renders once. The PDF is kept in
 * the row for a day (bounded by BEMMOLY_PDF_MAX_BYTES) and only the person who asked reads
 * it; the nightly purge deletes expired rows. A new table, so the previous minor never sees it.
 */
export default changeset({
  id: '0017-docs-page-exports',
  author: 'bemmoly',
  description: 'Create page_exports for PDF exports rendered as a job',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE page_exports (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        page_id uuid NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
        requested_by uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        idempotency_key text NOT NULL,
        scope text NOT NULL CHECK (scope IN ('page', 'subtree')),
        paper text NOT NULL CHECK (paper IN ('a4', 'letter')),
        status text NOT NULL DEFAULT 'queued'
          CHECK (status IN ('queued', 'ready', 'failed')),
        file_name text NOT NULL,
        pages integer NOT NULL DEFAULT 0,
        size integer,
        pdf bytea,
        error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL DEFAULT now() + interval '1 day'
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX page_exports_user_key ON page_exports (requested_by, idempotency_key)`);
    await ctx.exec(sql`CREATE INDEX page_exports_page_id_idx ON page_exports (page_id)`);
    await ctx.exec(sql`CREATE INDEX page_exports_expires_at_idx ON page_exports (expires_at)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE page_exports`);
  },
});
