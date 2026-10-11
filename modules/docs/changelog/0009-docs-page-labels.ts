import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Page labels are free tags, not a managed list: the label is its name,
 * compared case-insensitively, so "RFC" and "rfc" are one label.
 */
export default changeset({
  id: '0009-docs-page-labels',
  author: 'bemmoly',
  description: 'Create page_labels',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE page_labels (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        page_id uuid NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX page_labels_page_name_key ON page_labels (page_id, lower(name))`);
    await ctx.exec(sql`CREATE INDEX page_labels_name_idx ON page_labels (lower(name))`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE page_labels`);
  },
});
