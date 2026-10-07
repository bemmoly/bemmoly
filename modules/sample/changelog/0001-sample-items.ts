import { changeset, sql } from '@bemmoly/core/changelog';

export default changeset({
  id: '0001-sample-items',
  author: 'bemmoly',
  description: 'Create sample_items, the sample module’s only table',
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE sample_items (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 200),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE sample_items`);
  },
});
