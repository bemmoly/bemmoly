import { changeset, sql } from '@bemmoly/core/changelog';

/** completed_snapshot is written once on close and feeds the velocity report. */
export default changeset({
  id: '0005-work-sprints',
  author: 'bemmoly',
  description: 'Create sprints',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE sprints (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
        goal text,
        starts_at timestamptz,
        ends_at timestamptz,
        state text NOT NULL DEFAULT 'future'
          CONSTRAINT sprints_state_check CHECK (state IN ('future', 'active', 'closed')),
        capacity_points numeric(10, 2) CHECK (capacity_points >= 0),
        completed_snapshot jsonb,
        started_at timestamptz,
        closed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT sprints_dates_check CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
      )`);
    await ctx.exec(sql`CREATE INDEX sprints_project_state_idx ON sprints (project_id, state)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE sprints`);
  },
});
