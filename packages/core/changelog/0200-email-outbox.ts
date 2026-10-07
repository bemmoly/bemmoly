import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

export default changeset({
  id: '0200-email-outbox',
  author: 'keerthi',
  description: 'Add the email outbox that every product email passes through',
  up: async (ctx) => {
    await ctx.exec(sql`
      create table email_outbox (
        id uuid primary key default uuidv7(),
        kind text not null,
        to_address text not null,
        to_name text,
        subject text not null,
        html text not null,
        text text not null,
        headers jsonb not null default '{}'::jsonb,
        status text not null default 'pending'
          constraint email_outbox_status_check
          check (status in ('pending', 'sending', 'sent', 'failed')),
        attempts integer not null default 0,
        last_error text,
        next_attempt_at timestamptz not null default now(),
        sent_at timestamptz,
        provider text,
        message_id text,
        dedupe_key text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`
      create unique index email_outbox_dedupe_key_idx
        on email_outbox (dedupe_key) where dedupe_key is not null`);
    await ctx.exec(sql`
      create index email_outbox_due_idx
        on email_outbox (next_attempt_at) where status in ('pending', 'sending')`);
    await ctx.exec(sql`
      create index email_outbox_failed_idx
        on email_outbox (updated_at) where status = 'failed'`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table email_outbox`);
  },
});
