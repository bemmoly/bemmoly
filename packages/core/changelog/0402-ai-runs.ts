import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Every model call: what it was for, which model and prompt version, the input hash, tokens,
 * cost from the catalog's prices, latency, outcome and feedback. The monthly budget is summed
 * from cost_usd over created_at, hence the index.
 */
export default changeset({
  id: '0402-ai-runs',
  author: 'keerthi',
  description: 'Add the AI run log with cost and feedback',
  up: async (ctx) => {
    await ctx.exec(sql`
      create table ai_runs (
        id uuid primary key default uuidv7(),
        role text not null,
        purpose text not null,
        provider_id uuid references ai_providers (id) on delete set null,
        model text,
        prompt_id text,
        prompt_version integer,
        input_hash text not null,
        input_tokens integer not null default 0,
        output_tokens integer not null default 0,
        cost_usd numeric(14, 6) not null default 0,
        latency_ms integer not null default 0,
        outcome text not null
          constraint ai_runs_outcome_check check (outcome in
            ('ok', 'repaired', 'error', 'invalid_output', 'timeout', 'cancelled', 'refused')),
        error text,
        feedback text constraint ai_runs_feedback_check check (feedback in ('useful', 'not_useful')),
        user_id uuid references users (id) on delete set null,
        request_id text,
        created_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`create index ai_runs_created_at_idx on ai_runs (created_at)`);
    await ctx.exec(sql`create index ai_runs_user_id_idx on ai_runs (user_id, created_at)`);
    await ctx.exec(sql`
      create index ai_runs_prompt_idx on ai_runs (prompt_id, prompt_version)
        where prompt_id is not null`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table ai_runs`);
  },
});
