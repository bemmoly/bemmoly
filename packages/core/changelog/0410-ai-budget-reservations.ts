import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Budget held by AI calls still in flight. A standard or strong call reserves its estimated
 * cost before it reaches the provider and releases it once its ai_runs row is written, so
 * concurrent calls in any process see each other before the cost is known. A row stops counting
 * at expires_at, so a crashed process cannot hold budget forever; the index serves both the
 * live sum and the purge of expired rows.
 */
export default changeset({
  id: '0410-ai-budget-reservations',
  author: 'keerthi',
  description: 'Add budget reservations for AI calls in flight',
  up: async (ctx) => {
    await ctx.exec(sql`
      create table ai_budget_reservations (
        id uuid primary key default uuidv7(),
        role text not null,
        amount_usd numeric(14, 6) not null
          constraint ai_budget_reservations_amount_check check (amount_usd >= 0),
        expires_at timestamptz not null,
        created_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`
      create index ai_budget_reservations_expires_at_idx on ai_budget_reservations (expires_at)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table ai_budget_reservations`);
  },
});
