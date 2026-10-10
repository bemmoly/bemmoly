import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * The ⌘K palette's plans (tech design §11.4). A plan is one person's request and the steps the
 * model proposed, each with the permission check made as that person. Steps get their own
 * rows keyed by (plan_id, step_index): the run job claims a step by moving it from pending to
 * running, which is what makes a re-delivered job skip what already ran. Audit rows point back
 * through audit_log.ai_plan_id.
 */
export default changeset({
  id: '0408-ai-plans',
  author: 'keerthi',
  description: 'Add command palette plans and their steps',
  preconditions: [
    {
      tableExists: { table: 'users' },
      onFail: 'halt',
      reason: 'plans belong to a person; the identity changesets run first',
    },
  ],
  up: async (ctx) => {
    await ctx.exec(sql`
      create table ai_plans (
        id uuid primary key default uuidv7(),
        user_id uuid not null references users (id) on delete cascade,
        request_text text not null,
        summary text,
        status text not null default 'proposed'
          constraint ai_plans_status_check check (status in
            ('proposed', 'approved', 'running', 'done', 'failed', 'cancelled')),
        runnable boolean not null default true,
        context jsonb not null default '{}'::jsonb,
        run_id uuid references ai_runs (id) on delete set null,
        approved_by uuid references users (id) on delete set null,
        approved_at timestamptz,
        finished_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`create index ai_plans_user_id_idx on ai_plans (user_id, id desc)`);
    await ctx.exec(sql`
      create table ai_plan_steps (
        plan_id uuid not null references ai_plans (id) on delete cascade,
        step_index integer not null constraint ai_plan_steps_index_check check (step_index >= 0),
        tool text not null,
        args jsonb not null,
        preview jsonb not null,
        permission text not null
          constraint ai_plan_steps_permission_check check (permission in ('ALLOWED', 'DENIED')),
        reason text,
        status text not null default 'proposed'
          constraint ai_plan_steps_status_check check (status in
            ('proposed', 'pending', 'skipped', 'running', 'done', 'failed', 'undone')),
        result jsonb,
        undo jsonb,
        error text,
        started_at timestamptz,
        finished_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (plan_id, step_index)
      )`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table ai_plan_steps`);
    await ctx.exec(sql`drop table ai_plans`);
  },
});
