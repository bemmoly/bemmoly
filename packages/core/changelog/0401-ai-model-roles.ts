import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * One row per assigned role. The capabilities snapshot is copied from the catalog when the
 * role is assigned, so a catalog refresh cannot silently change behaviour or prices.
 */
export default changeset({
  id: '0401-ai-model-roles',
  author: 'keerthi',
  description: 'Add AI model roles with a capabilities snapshot',
  up: async (ctx) => {
    await ctx.exec(sql`
      create table ai_model_roles (
        id uuid primary key default uuidv7(),
        role text not null
          constraint ai_model_roles_role_check
          check (role in ('fast', 'standard', 'strong', 'embedding')),
        provider_id uuid not null references ai_providers (id) on delete cascade,
        model text not null,
        reasoning_effort text
          constraint ai_model_roles_effort_check check (reasoning_effort in ('low', 'medium', 'high')),
        max_output_tokens integer,
        temperature numeric(3, 2),
        capabilities jsonb not null,
        deprecated_at timestamptz,
        deprecated_successor text,
        updated_by uuid references users (id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`create unique index ai_model_roles_role_key on ai_model_roles (role)`);
    await ctx.exec(
      sql`create index ai_model_roles_provider_id_idx on ai_model_roles (provider_id)`,
    );
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table ai_model_roles`);
  },
});
