import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

export default changeset({
  id: '0201-notifications',
  author: 'keerthi',
  description: 'Add inbox notifications, written in the transaction of the event that caused them',
  preconditions: [
    {
      tableExists: { table: 'users' },
      onFail: 'halt',
      reason: 'notifications reference users; the identity changesets run first',
    },
  ],
  up: async (ctx) => {
    await ctx.exec(sql`
      create table notifications (
        id uuid primary key default uuidv7(),
        user_id uuid not null references users (id) on delete cascade,
        kind text not null,
        actor_id uuid references users (id) on delete set null,
        actor_name text,
        target_kind text not null,
        target_id text not null,
        target_label text,
        target_url text,
        body text not null default '',
        reason text,
        data jsonb not null default '{}'::jsonb,
        delivery text not null
          constraint notifications_delivery_check
          check (delivery in ('inapp', 'email_immediate', 'email_digest')),
        dedupe_key text,
        read_at timestamptz,
        emailed_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`
      create index notifications_user_id_idx on notifications (user_id, id desc)`);
    await ctx.exec(sql`
      create index notifications_unread_idx on notifications (user_id) where read_at is null`);
    await ctx.exec(sql`
      create index notifications_digest_pending_idx on notifications (user_id, id)
        where delivery = 'email_digest' and emailed_at is null and read_at is null`);
    await ctx.exec(sql`
      create unique index notifications_dedupe_key_idx on notifications (user_id, dedupe_key)
        where dedupe_key is not null`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table notifications`);
  },
});
