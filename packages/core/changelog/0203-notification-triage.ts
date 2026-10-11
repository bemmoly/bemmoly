import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

export default changeset({
  id: '0203-notification-triage',
  author: 'keerthi',
  description: 'Let inbox entries be marked done and snoozed',
  preconditions: [
    {
      tableExists: { table: 'notifications' },
      onFail: 'halt',
      reason: 'triage columns extend the notifications table from 0201',
    },
  ],
  up: async (ctx) => {
    // Nullable with no default, so the previous minor keeps inserting rows unchanged.
    await ctx.exec(sql`
      alter table notifications
        add column done_at timestamptz,
        add column snoozed_until timestamptz`);
    // The inbox view is every listing's default and leaves done rows behind, which pile up.
    await ctx.exec(sql`
      create index notifications_inbox_idx on notifications (user_id, id desc)
        where done_at is null`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop index notifications_inbox_idx`);
    await ctx.exec(sql`
      alter table notifications
        drop column snoozed_until,
        drop column done_at`);
  },
});
