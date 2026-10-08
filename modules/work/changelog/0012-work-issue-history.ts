import { changeset, sql } from '@bemmoly/core/changelog';

/** Append only, like audit_log: one row per field change, never updated. */
export default changeset({
  id: '0012-work-issue-history',
  author: 'bemmoly',
  description: 'Create issue_history',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE issue_history (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        issue_id uuid NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
        actor_id uuid REFERENCES users (id) ON DELETE SET NULL,
        field text NOT NULL CHECK (char_length(field) BETWEEN 1 AND 60),
        from_value jsonb,
        to_value jsonb,
        ai_plan_id uuid,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE INDEX issue_history_issue_idx ON issue_history (issue_id, id)`);
    await ctx.exec(sql`
      CREATE INDEX issue_history_field_idx ON issue_history (field, created_at)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE issue_history`);
  },
});
