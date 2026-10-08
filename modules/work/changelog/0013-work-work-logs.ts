import { changeset, sql } from '@bemmoly/core/changelog';

export default changeset({
  id: '0013-work-work-logs',
  author: 'bemmoly',
  description: 'Create work_logs',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE work_logs (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        issue_id uuid NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        minutes integer NOT NULL CHECK (minutes > 0),
        started_at timestamptz NOT NULL DEFAULT now(),
        note text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE INDEX work_logs_issue_id_idx ON work_logs (issue_id)`);
    await ctx.exec(sql`CREATE INDEX work_logs_user_started_idx ON work_logs (user_id, started_at)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE work_logs`);
  },
});
