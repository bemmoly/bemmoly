import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * A time-in-status rule fires once per stay: one issue, one status, entered at one moment.
 * The row is the claim and its key is the stay, so two schedulers ticking at once, or the
 * same tick repeated, still queue one run. Leaving the status and coming back is a new stay.
 */
export default changeset({
  id: '0037-work-automation-stays',
  author: 'bemmoly',
  description: 'Create automation_stays, the stays a time-in-status rule has fired for',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE automation_stays (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        rule_id uuid NOT NULL REFERENCES automation_rules (id) ON DELETE CASCADE,
        issue_id uuid NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
        status_id uuid NOT NULL REFERENCES workflow_statuses (id) ON DELETE CASCADE,
        entered_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX automation_stays_stay_key
        ON automation_stays (rule_id, issue_id, status_id, entered_at)`);
    await ctx.exec(sql`CREATE INDEX automation_stays_issue_id_idx ON automation_stays (issue_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE automation_stays`);
  },
});
