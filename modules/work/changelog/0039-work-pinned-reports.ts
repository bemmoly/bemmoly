import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Reports a person asked for and pinned to their Reports view. The row keeps the question
 * and the validated report spec, never the numbers, so each pin is rebuilt live on read.
 * A pin belongs to one person in one project and goes when either does.
 */
export default changeset({
  id: '0039-work-pinned-reports',
  author: 'bemmoly',
  description: 'Create pinned_reports',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE pinned_reports (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        owner_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        question text NOT NULL CHECK (char_length(question) BETWEEN 1 AND 500),
        spec jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX pinned_reports_owner_project_idx
        ON pinned_reports (owner_id, project_id, created_at)`);
    await ctx.exec(sql`CREATE INDEX pinned_reports_project_id_idx ON pinned_reports (project_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE pinned_reports`);
  },
});
