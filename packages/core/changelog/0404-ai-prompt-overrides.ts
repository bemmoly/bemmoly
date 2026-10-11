import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/* Repository prompts are the default; an override row wins until it is reset. */
export default changeset({
  id: '0404-ai-prompt-overrides',
  author: 'keerthi',
  description: 'Add admin overrides for AI prompts',
  up: async (ctx) => {
    await ctx.exec(sql`
      create table ai_prompt_overrides (
        id uuid primary key default uuidv7(),
        prompt_id text not null,
        template text not null,
        base_version integer not null,
        updated_by uuid references users (id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`
      create unique index ai_prompt_overrides_prompt_id_key on ai_prompt_overrides (prompt_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table ai_prompt_overrides`);
  },
});
