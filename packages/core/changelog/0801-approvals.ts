import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * The approval engine (ADR 0051): workflow definitions and their immutable versions, the
 * requests modules start, one task per approver per stage, and each person's delegate while
 * away. New tables only; the previous minor reads none of them.
 */
export default changeset({
  id: '0801-approvals',
  author: 'bemmoly',
  description: 'Create approval workflows, versions, requests, tasks and delegations',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE approval_workflows (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        module_id text NOT NULL,
        key text NOT NULL CHECK (char_length(key) BETWEEN 1 AND 120),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
        latest_version integer NOT NULL DEFAULT 0 CHECK (latest_version >= 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX approval_workflows_module_key_key ON approval_workflows (module_id, key)`);
    await ctx.exec(sql`
      CREATE TABLE approval_workflow_versions (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        workflow_id uuid NOT NULL REFERENCES approval_workflows (id) ON DELETE CASCADE,
        version integer NOT NULL CHECK (version > 0),
        spec jsonb NOT NULL,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX approval_workflow_versions_workflow_version_key
        ON approval_workflow_versions (workflow_id, version)`);
    await ctx.exec(sql`
      CREATE TABLE approval_requests (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        workflow_version_id uuid NOT NULL
          REFERENCES approval_workflow_versions (id) ON DELETE RESTRICT,
        module_id text NOT NULL,
        workflow_key text NOT NULL,
        subject_kind text NOT NULL,
        subject_id text NOT NULL,
        title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
        url text,
        requester_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
        fields jsonb NOT NULL DEFAULT '{}'::jsonb,
        status text NOT NULL DEFAULT 'pending'
          CONSTRAINT approval_requests_status_check
          CHECK (status IN ('pending', 'escalated', 'approved', 'rejected', 'withdrawn')),
        current_stage integer CHECK (current_stage >= 0),
        auto_approved boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        closed_at timestamptz
      )`);
    await ctx.exec(sql`
      CREATE INDEX approval_requests_subject_idx
        ON approval_requests (module_id, subject_kind, subject_id)`);
    await ctx.exec(sql`
      CREATE INDEX approval_requests_requester_idx ON approval_requests (requester_id, id DESC)`);
    await ctx.exec(sql`
      CREATE TABLE approval_tasks (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        request_id uuid NOT NULL REFERENCES approval_requests (id) ON DELETE CASCADE,
        stage integer NOT NULL CHECK (stage >= 0),
        approver_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
        on_behalf_of uuid REFERENCES users (id) ON DELETE SET NULL,
        status text NOT NULL DEFAULT 'pending'
          CONSTRAINT approval_tasks_status_check
          CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
        escalation boolean NOT NULL DEFAULT false,
        comment text CHECK (char_length(comment) <= 2000),
        due_at timestamptz,
        decided_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE INDEX approval_tasks_request_idx ON approval_tasks (request_id)`);
    await ctx.exec(sql`
      CREATE INDEX approval_tasks_waiting_idx ON approval_tasks (approver_id, request_id DESC)
        WHERE status = 'pending'`);
    await ctx.exec(sql`
      CREATE TABLE approval_delegations (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        delegate_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        starts_at timestamptz NOT NULL,
        ends_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT approval_delegations_period_check CHECK (ends_at > starts_at),
        CONSTRAINT approval_delegations_self_check CHECK (delegate_id <> user_id)
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX approval_delegations_user_key ON approval_delegations (user_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE approval_delegations`);
    await ctx.exec(sql`DROP TABLE approval_tasks`);
    await ctx.exec(sql`DROP TABLE approval_requests`);
    await ctx.exec(sql`DROP TABLE approval_workflow_versions`);
    await ctx.exec(sql`DROP TABLE approval_workflows`);
  },
});
