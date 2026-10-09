import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The tables land in this release so the automation engine of the next one
 * adds no schema. A rule the AI drafts from a sentence arrives with
 * is_draft set and stays off until an admin saves it.
 */
export default changeset({
  id: '0016-work-automation',
  author: 'bemmoly',
  description: 'Create automation_rules and automation_runs',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE automation_rules (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        project_id uuid REFERENCES projects (id) ON DELETE CASCADE,
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
        enabled boolean NOT NULL DEFAULT false,
        is_draft boolean NOT NULL DEFAULT false,
        trigger jsonb NOT NULL,
        conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
        actions jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        ai_run_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX automation_rules_project_id_idx ON automation_rules (project_id)`);
    await ctx.exec(sql`
      CREATE TABLE automation_runs (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        rule_id uuid NOT NULL REFERENCES automation_rules (id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'queued'
          CONSTRAINT automation_runs_status_check
          CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
        input jsonb NOT NULL DEFAULT '{}'::jsonb,
        result jsonb,
        error text,
        duration_ms integer CHECK (duration_ms >= 0),
        started_at timestamptz,
        finished_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE INDEX automation_runs_rule_idx ON automation_runs (rule_id, id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE automation_runs`);
    await ctx.exec(sql`DROP TABLE automation_rules`);
  },
});
