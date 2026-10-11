import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Connected AI providers. Credentials and headers are one sealed JSON object each, encrypted
 * with the install's secret key and bound to the row id; their names are kept in the clear so
 * the API can say which are set without decrypting anything.
 */
export default changeset({
  id: '0400-ai-providers',
  author: 'keerthi',
  description: 'Add AI providers with encrypted credentials',
  preconditions: [
    {
      tableExists: { table: 'users' },
      onFail: 'halt',
      reason: 'ai_providers records who created a provider; the identity changesets run first',
    },
  ],
  up: async (ctx) => {
    await ctx.exec(sql`
      create table ai_providers (
        id uuid primary key default uuidv7(),
        catalog_id text not null,
        protocol text
          constraint ai_providers_protocol_check
          check (protocol in ('openai-compatible', 'anthropic-compatible')),
        name text not null,
        base_url text,
        credentials_encrypted text,
        credential_names text[] not null default '{}',
        headers_encrypted text,
        header_names text[] not null default '{}',
        models jsonb not null default '[]'::jsonb,
        is_default boolean not null default false,
        status text not null default 'unchecked'
          constraint ai_providers_status_check check (status in ('unchecked', 'ok', 'failed')),
        last_checked_at timestamptz,
        last_error text,
        created_by uuid references users (id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint ai_providers_custom_protocol_check
          check ((catalog_id = 'custom') = (protocol is not null))
      )`);
    await ctx.exec(sql`
      create unique index ai_providers_default_idx on ai_providers (is_default) where is_default`);
    await ctx.exec(sql`create index ai_providers_catalog_id_idx on ai_providers (catalog_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table ai_providers`);
  },
});
