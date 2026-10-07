import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

export default changeset({
  id: '0202-notification-preferences',
  author: 'keerthi',
  description: 'Add per-kind notification preferences and each user’s digest schedule',
  preconditions: [
    {
      tableExists: { table: 'users' },
      onFail: 'halt',
      reason: 'preferences reference users; the identity changesets run first',
    },
  ],
  up: async (ctx) => {
    await ctx.exec(sql`
      create table notification_preferences (
        id uuid primary key default uuidv7(),
        user_id uuid not null references users (id) on delete cascade,
        kind text not null,
        channel text not null
          constraint notification_preferences_channel_check
          check (channel in ('inapp', 'email_immediate', 'email_digest', 'off')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`
      create unique index notification_preferences_user_kind_idx
        on notification_preferences (user_id, kind)`);
    await ctx.exec(sql`
      create table notification_schedules (
        id uuid primary key default uuidv7(),
        user_id uuid not null references users (id) on delete cascade,
        cadence text not null default 'interval'
          constraint notification_schedules_cadence_check
          check (cadence in ('interval', 'daily')),
        daily_hour smallint not null default 8
          constraint notification_schedules_daily_hour_check
          check (daily_hour between 0 and 23),
        time_zone text not null default 'UTC',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`
      create unique index notification_schedules_user_id_idx
        on notification_schedules (user_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table notification_schedules`);
    await ctx.exec(sql`drop table notification_preferences`);
  },
});
