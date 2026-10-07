import { sql } from 'drizzle-orm';
import { changeset } from '../src/contracts/changelog.ts';

export default changeset({
  id: '0300-backups',
  author: 'bemmoly',
  description: 'Add the backups table that indexes scheduled, manual and pre-upgrade backups',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      create table if not exists backups (
        id uuid primary key default uuidv7(),
        kind text not null check (kind in ('scheduled', 'manual', 'pre_upgrade')),
        status text not null default 'running'
          check (status in ('running', 'succeeded', 'failed', 'pruned')),
        set_name text not null unique,
        app_version text not null,
        changelog_tag text,
        scheduled_for timestamptz,
        attachment_mode text not null default 'incremental'
          check (attachment_mode in ('full', 'incremental')),
        base_backup_id uuid references backups (id) on delete set null,
        encrypted boolean not null default false,
        size_bytes bigint not null default 0,
        database_bytes bigint not null default 0,
        attachments_bytes bigint not null default 0,
        locations jsonb not null default '[]'::jsonb,
        manifest jsonb,
        verification_state text not null default 'pending'
          check (verification_state in ('pending', 'listed', 'restored', 'failed')),
        verification_message text,
        verified_at timestamptz,
        drilled_at timestamptz,
        error text,
        created_by uuid,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        completed_at timestamptz
      )`);
    await ctx.exec(
      sql`create index if not exists backups_kind_created_at_idx on backups (kind, created_at)`,
    );
    await ctx.exec(
      sql`create index if not exists backups_status_created_at_idx on backups (status, created_at)`,
    );
    await ctx.exec(sql`
      create unique index if not exists backups_scheduled_for_key on backups (scheduled_for)
        where scheduled_for is not null and status <> 'failed'`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table if exists backups`);
  },
});
