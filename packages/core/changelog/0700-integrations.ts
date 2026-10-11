import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Code integrations (tech design §17). integrations holds one connected code host: its kind,
 * the server address for self-managed installs, how the API is called, the repositories
 * backfill reads, and the webhook secret and API credentials sealed together with the
 * install's secret key (write-only; never read back to a client). integration_deliveries is
 * the log of inbound deliveries: the host's delivery id is unique per integration, so a
 * redelivery is recognised and answered without being applied twice.
 */
export default changeset({
  id: '0700-integrations',
  author: 'bemmoly',
  description: 'Add code host integrations and their inbound delivery log',
  preconditions: [
    {
      tableExists: { table: 'users' },
      onFail: 'halt',
      reason: 'an integration is added by a person; the identity changesets run first',
    },
  ],
  up: async (ctx) => {
    await ctx.exec(sql`
      create table integrations (
        id uuid primary key default uuidv7(),
        kind text not null constraint integrations_kind_check check (kind in ('github', 'gitlab')),
        name text not null check (char_length(name) between 1 and 80),
        base_url text check (base_url ~ '^https?://'),
        auth_mode text not null constraint integrations_auth_mode_check
          check (auth_mode in ('app', 'token')),
        app_id text,
        installation_id text,
        repositories text[] not null default '{}',
        secrets_encrypted text not null,
        enabled boolean not null default true,
        last_error text,
        last_error_at timestamptz,
        created_by uuid references users (id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`
      create table integration_deliveries (
        id uuid primary key default uuidv7(),
        integration_id uuid not null references integrations (id) on delete cascade,
        delivery_id text not null check (char_length(delivery_id) between 1 and 200),
        event text not null check (char_length(event) between 1 and 100),
        action text,
        outcome text not null constraint integration_deliveries_outcome_check
          check (outcome in ('processed', 'ignored', 'failed', 'test')),
        summary text not null default '',
        error text,
        received_at timestamptz not null default now(),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`
      create unique index integration_deliveries_delivery_key
        on integration_deliveries (integration_id, delivery_id)`);
    await ctx.exec(sql`
      create index integration_deliveries_recent_idx
        on integration_deliveries (integration_id, received_at desc)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table integration_deliveries`);
    await ctx.exec(sql`drop table integrations`);
  },
});
