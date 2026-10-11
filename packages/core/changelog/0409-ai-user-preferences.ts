import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * A person's own AI preferences that follow them across devices. A missing row means the
 * defaults: ghost text on. Opting out stays in ai_user_opt_outs, which the policy reads.
 */
export default changeset({
  id: '0409-ai-user-preferences',
  author: 'keerthi',
  description: "Add people's own AI preferences, starting with ghost text",
  up: async (ctx) => {
    await ctx.exec(sql`
      create table ai_user_preferences (
        user_id uuid primary key references users (id) on delete cascade,
        ghost_text boolean not null default true,
        updated_at timestamptz not null default now()
      )`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table ai_user_preferences`);
  },
});
