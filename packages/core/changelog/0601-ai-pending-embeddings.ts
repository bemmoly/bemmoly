import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Records whose embeddings are out of date, one row per record however often it changes, so a
 * bulk import queues one drain job per source instead of one job per change. `revision` moves
 * on every repeat change; a drain deletes only the revision it indexed, so an edit that lands
 * while a drain runs is indexed again.
 */
export default changeset({
  id: '0601-ai-pending-embeddings',
  author: 'keerthi',
  description: 'Add the pending embeddings set that coalesces retrieval index work',
  up: async (ctx) => {
    await ctx.exec(sql`
      create table pending_embeddings (
        id uuid primary key default uuidv7(),
        target_kind text not null,
        target_id text not null,
        revision integer not null default 0,
        created_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`
      create unique index pending_embeddings_target_key
        on pending_embeddings (target_kind, target_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table pending_embeddings`);
  },
});
