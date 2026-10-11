import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * What the automation engine needs beside 0016's tables: whose permissions a rule acts with
 * (whoever saved it last), when a scheduled rule last fired, and per run the issue, what
 * triggered it and how deep in a chain of rules it sits, plus a skipped status for runs whose
 * conditions did not match or that loop protection stopped. The previous minor only ever
 * queued a no-op job, so nothing it runs reads these columns.
 */
export default changeset({
  id: '0028-work-automation-engine',
  author: 'bemmoly',
  description: 'Add rule owners, schedules and run details to automation tables',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE automation_rules
        ADD COLUMN owner_id uuid REFERENCES users (id) ON DELETE SET NULL,
        ADD COLUMN last_scheduled_at timestamptz`);
    await ctx.exec(sql`
      CREATE INDEX automation_rules_trigger_idx ON automation_rules ((trigger ->> 'name'))
        WHERE enabled AND NOT is_draft`);
    await ctx.exec(sql`
      ALTER TABLE automation_runs
        DROP CONSTRAINT automation_runs_status_check,
        ADD CONSTRAINT automation_runs_status_check
          CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'skipped')),
        ADD COLUMN trigger text NOT NULL DEFAULT 'event',
        ADD COLUMN issue_id uuid REFERENCES issues (id) ON DELETE SET NULL,
        ADD COLUMN depth integer NOT NULL DEFAULT 0 CHECK (depth >= 0)`);
    await ctx.exec(sql`CREATE INDEX automation_runs_status_idx ON automation_runs (status, id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP INDEX automation_runs_status_idx`);
    await ctx.exec(sql`DELETE FROM automation_runs WHERE status = 'skipped'`);
    await ctx.exec(sql`
      ALTER TABLE automation_runs
        DROP COLUMN depth,
        DROP COLUMN issue_id,
        DROP COLUMN trigger,
        DROP CONSTRAINT automation_runs_status_check,
        ADD CONSTRAINT automation_runs_status_check
          CHECK (status IN ('queued', 'running', 'succeeded', 'failed'))`);
    await ctx.exec(sql`DROP INDEX automation_rules_trigger_idx`);
    await ctx.exec(sql`
      ALTER TABLE automation_rules DROP COLUMN last_scheduled_at, DROP COLUMN owner_id`);
  },
});
