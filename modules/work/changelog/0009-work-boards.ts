import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * One row per board. config holds the columns with their status ids and WIP
 * limits, lanes, card fields, colour rules, estimation unit, cadence and
 * working days; the org default board scheme is the row with no project.
 */
export default changeset({
  id: '0009-work-boards',
  author: 'bemmoly',
  description: 'Create boards',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE boards (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        project_id uuid REFERENCES projects (id) ON DELETE CASCADE,
        origin_id uuid REFERENCES boards (id) ON DELETE SET NULL,
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
        config jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE INDEX boards_project_id_idx ON boards (project_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE boards`);
  },
});
