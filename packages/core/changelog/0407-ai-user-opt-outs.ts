import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * People who turned AI off for themselves, when the admin allows it: their AI surfaces hide
 * and their authored content is sent only as titles in summaries others request.
 */
export default changeset({
  id: '0407-ai-user-opt-outs',
  author: 'keerthi',
  description: "Add people's own AI opt-outs",
  up: async (ctx) => {
    await ctx.exec(sql`
      create table ai_user_opt_outs (
        user_id uuid primary key references users (id) on delete cascade,
        created_at timestamptz not null default now()
      )`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table ai_user_opt_outs`);
  },
});
