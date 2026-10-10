import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Cached generated content, one row per target and kind, keyed by the hash of the inputs the
 * builder used: regenerated only when the hash changes, stale content served while it
 * refreshes. target_id is a uuid: an issue, a page, a sprint, or a user for the morning brief.
 */
export default changeset({
  id: '0405-ai-insights',
  author: 'keerthi',
  description: 'Add the AI insight cache keyed by target and input hash',
  up: async (ctx) => {
    await ctx.exec(sql`
      create table ai_insights (
        id uuid primary key default uuidv7(),
        target_kind text not null,
        target_id uuid not null,
        kind text not null,
        input_hash text not null,
        content jsonb,
        status text not null default 'ready'
          constraint ai_insights_status_check check (status in ('ready', 'refreshing', 'failed')),
        error text,
        run_id uuid references ai_runs (id) on delete set null,
        feedback text
          constraint ai_insights_feedback_check check (feedback in ('useful', 'not_useful')),
        generated_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`
      create unique index ai_insights_target_key on ai_insights (target_kind, target_id, kind)`);
    await ctx.exec(
      sql`create index ai_insights_kind_updated_idx on ai_insights (kind, updated_at)`,
    );
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table ai_insights`);
  },
});
