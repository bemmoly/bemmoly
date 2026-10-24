import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * What a page is (ADR 0049): written, one file drawn full bleed, or a folder. Defaults to
 * a written page, so the previous minor, which never names the column, reads and writes
 * pages as before. Pages made by Upload HTML or PDF before this (a body of one PDF or HTML
 * File block, beside empty paragraphs only) become file pages.
 */
export default changeset({
  id: '0022-docs-page-kind',
  author: 'bemmoly',
  description: 'Store whether a page is written, one file, or a folder',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE pages ADD COLUMN kind text NOT NULL DEFAULT 'page'
        CONSTRAINT pages_kind_check CHECK (kind IN ('page', 'file', 'folder'))`);
    await ctx.exec(sql`
      UPDATE pages p SET kind = 'file'
      WHERE jsonb_typeof(p.snapshot -> 'content') = 'array'
        AND (SELECT count(*) FROM jsonb_array_elements(p.snapshot -> 'content') b
             WHERE b ->> 'type' = 'file'
               AND b -> 'attrs' ->> 'mime' IN ('text/html', 'application/pdf')) = 1
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(p.snapshot -> 'content') b
          WHERE b ->> 'type' <> 'file'
            AND NOT (b ->> 'type' = 'paragraph'
              AND coalesce(jsonb_array_length(b -> 'content'), 0) = 0))`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`ALTER TABLE pages DROP COLUMN kind`);
  },
});
