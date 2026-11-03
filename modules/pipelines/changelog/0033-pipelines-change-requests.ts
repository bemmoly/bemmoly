import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Change requests move one or more service versions into an environment with an approval
 * rule. A request holds its items (a version per service), the steps copied from the rule
 * when it was sent (so a later rule change never moves a request under way), the people the
 * requester picked for each step, and each decision. Once approved, each item points at the
 * promotion that deploys it. Not `pipeline_changes`, which is the "What changed?" log.
 */
export default changeset({
  id: '0033-pipelines-change-requests',
  author: 'bemmoly',
  description: 'Create change requests with their items, steps, picked approvers and decisions',
  contexts: ['*'],
  up: async (ctx) => {
    // People read CHG-1001 and on; the number is the request's name, never reused.
    await ctx.exec(sql`CREATE SEQUENCE pipeline_change_request_number_seq START WITH 1001`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_change_requests (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        number bigint NOT NULL DEFAULT nextval('pipeline_change_request_number_seq'),
        environment_id uuid NOT NULL REFERENCES pipeline_environments (id) ON DELETE CASCADE,
        title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
        why text NOT NULL,
        risk text NOT NULL CHECK (risk IN ('low', 'medium', 'high')),
        deploy_at timestamptz,
        rollback text NOT NULL DEFAULT '',
        status text NOT NULL DEFAULT 'draft' CHECK (status IN (
          'draft', 'waiting', 'approved', 'deploying', 'deployed', 'rejected', 'withdrawn'
        )),
        requested_by uuid REFERENCES users (id) ON DELETE SET NULL,
        sent_at timestamptz,
        decided_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      ALTER SEQUENCE pipeline_change_request_number_seq OWNED BY pipeline_change_requests.number`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_change_requests_number_key
        ON pipeline_change_requests (number)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_change_requests_status_idx
        ON pipeline_change_requests (status, created_at DESC, id)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_change_requests_requester_idx
        ON pipeline_change_requests (requested_by, created_at DESC)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_change_requests_environment_idx
        ON pipeline_change_requests (environment_id, created_at DESC)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_change_request_items (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        change_request_id uuid NOT NULL
          REFERENCES pipeline_change_requests (id) ON DELETE CASCADE,
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        release_id uuid NOT NULL REFERENCES pipeline_releases (id) ON DELETE CASCADE,
        from_release_id uuid REFERENCES pipeline_releases (id) ON DELETE SET NULL,
        promotion_id uuid REFERENCES pipeline_promotions (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_change_request_items_key
        ON pipeline_change_request_items (change_request_id, application_id)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_change_request_items_release_idx
        ON pipeline_change_request_items (release_id)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_change_request_items_promotion_idx
        ON pipeline_change_request_items (promotion_id) WHERE promotion_id IS NOT NULL`);
    // The group's name is kept with the step, so the route still reads after a group goes.
    await ctx.exec(sql`
      CREATE TABLE pipeline_change_request_steps (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        change_request_id uuid NOT NULL
          REFERENCES pipeline_change_requests (id) ON DELETE CASCADE,
        position integer NOT NULL CHECK (position >= 0),
        group_id uuid REFERENCES pipeline_approval_groups (id) ON DELETE SET NULL,
        group_name text NOT NULL,
        count integer NOT NULL CHECK (count BETWEEN 1 AND 10),
        condition text NOT NULL CHECK (condition IN ('always', 'high_risk')),
        state text NOT NULL DEFAULT 'queued'
          CHECK (state IN ('queued', 'waiting', 'approved', 'rejected')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_change_request_steps_key
        ON pipeline_change_request_steps (change_request_id, position)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_change_request_picks (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        step_id uuid NOT NULL REFERENCES pipeline_change_request_steps (id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_change_request_picks_key
        ON pipeline_change_request_picks (step_id, user_id)`);
    // "Waiting for you": the requests a person was picked for.
    await ctx.exec(sql`
      CREATE INDEX pipeline_change_request_picks_user_idx
        ON pipeline_change_request_picks (user_id)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_change_request_approvals (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        step_id uuid NOT NULL REFERENCES pipeline_change_request_steps (id) ON DELETE CASCADE,
        user_id uuid REFERENCES users (id) ON DELETE SET NULL,
        decision text NOT NULL
          CHECK (decision IN ('approved', 'rejected', 'changes_requested')),
        note text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_change_request_approvals_step_idx
        ON pipeline_change_request_approvals (step_id, created_at)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_change_request_approvals_user_idx
        ON pipeline_change_request_approvals (user_id, created_at DESC)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE pipeline_change_request_approvals`);
    await ctx.exec(sql`DROP TABLE pipeline_change_request_picks`);
    await ctx.exec(sql`DROP TABLE pipeline_change_request_steps`);
    await ctx.exec(sql`DROP TABLE pipeline_change_request_items`);
    // The sequence is owned by the number column and goes with the table.
    await ctx.exec(sql`DROP TABLE pipeline_change_requests`);
  },
});
