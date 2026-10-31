import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The company's career ladder, in order. The kernel's person record keeps the level as text
 * (ADR 0050); this is the list a profile picks from.
 */
export default changeset({
  id: '0001-people-levels',
  author: 'bemmoly',
  description: 'Create the career levels list',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE people_levels (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
        description text,
        position integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE UNIQUE INDEX people_levels_name_key ON people_levels (lower(name))`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE people_levels`);
  },
});
