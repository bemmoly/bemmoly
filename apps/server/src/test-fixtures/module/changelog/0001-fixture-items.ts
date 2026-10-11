import { changeset, sql } from '@bemmoly/core/changelog';

export default changeset({
  id: '0001-fixture-items',
  author: 'bemmoly',
  description: 'Create fixture_items, the test fixture module’s only table',
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE fixture_items (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 200),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE fixture_items`);
  },
});
