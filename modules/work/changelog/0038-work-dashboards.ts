import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * A dashboard is one person's grid of report widgets over a project. The widgets are a small
 * ordered list read and written whole with the dashboard, so they live in one jsonb column
 * whose shape modules/work/shared/dashboards.ts validates on every write.
 */
export default changeset({
  id: '0038-work-dashboards',
  author: 'bemmoly',
  description: 'Create dashboards',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE dashboards (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        owner_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
        widgets jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(widgets) = 'array'),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX dashboards_owner_project_idx ON dashboards (owner_id, project_id)`);
    await ctx.exec(sql`CREATE INDEX dashboards_project_id_idx ON dashboards (project_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE IF EXISTS dashboards`);
  },
});
