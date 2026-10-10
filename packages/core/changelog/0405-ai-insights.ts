import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Cached generated content keyed by target and the hash of the inputs the builder used:
 * regenerated only when the hash changes. Stale content is served while it refreshes.
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
        target_id text not null,
        kind text not null,
        input_hash text not null,
        content jsonb not null default '{}'::jsonb,
        status text not null default 'fresh'
          constraint ai_insights_status_check check (status in ('fresh', 'refreshing', 'failed')),
        error text,
        run_id uuid references ai_runs (id) on delete set null,
        feedback text constraint ai_insights_feedback_check check (feedback in ('useful', 'not_useful')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`
      create unique index ai_insights_target_key on ai_insights (target_kind, target_id, kind)`);
    await ctx.exec(sql`
      create index ai_insights_refreshing_idx on ai_insights (updated_at) where status = 'refreshing'`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table ai_insights`);
  },
});
