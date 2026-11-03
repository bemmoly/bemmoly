import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * What change requests need beyond their tables: two more states (an approver asked for
 * changes; a deploy it started failed), the reason an admin gave for an emergency deploy, an
 * activity log, and on each promotion the request that started it, so the promotion engine
 * knows people already approved it and never asks again.
 */
export default changeset({
  id: '0037-pipelines-change-request-flow',
  author: 'bemmoly',
  description: 'Add change request activity, emergency reasons and the promotion link',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE pipeline_change_requests
        DROP CONSTRAINT pipeline_change_requests_status_check,
        ADD CONSTRAINT pipeline_change_requests_status_check CHECK (status IN (
          'draft', 'waiting', 'changes_requested', 'approved', 'deploying', 'deployed',
          'failed', 'rejected', 'withdrawn'
        )),
        ADD COLUMN emergency_reason text`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_change_request_events (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        change_request_id uuid NOT NULL
          REFERENCES pipeline_change_requests (id) ON DELETE CASCADE,
        user_id uuid REFERENCES users (id) ON DELETE SET NULL,
        kind text NOT NULL CHECK (char_length(kind) BETWEEN 1 AND 40),
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_change_request_events_request_idx
        ON pipeline_change_request_events (change_request_id, created_at, id)`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_promotions
        ADD COLUMN change_request_id uuid
          REFERENCES pipeline_change_requests (id) ON DELETE SET NULL`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_promotions_change_request_idx
        ON pipeline_promotions (change_request_id) WHERE change_request_id IS NOT NULL`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`ALTER TABLE pipeline_promotions DROP COLUMN change_request_id`);
    await ctx.exec(sql`DROP TABLE pipeline_change_request_events`);
    // The narrower check would refuse the new states, so those requests close as withdrawn.
    await ctx.exec(sql`
      UPDATE pipeline_change_requests SET status = 'withdrawn'
      WHERE status IN ('changes_requested', 'failed')`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_change_requests
        DROP COLUMN emergency_reason,
        DROP CONSTRAINT pipeline_change_requests_status_check,
        ADD CONSTRAINT pipeline_change_requests_status_check CHECK (status IN (
          'draft', 'waiting', 'approved', 'deploying', 'deployed', 'rejected', 'withdrawn'
        ))`);
  },
});
