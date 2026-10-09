import { changeset, sql } from '@bemmoly/core/changelog';

/** Polymorphic on target_kind, so Docs can add page subscriptions without a table. */
export default changeset({
  id: '0014-work-watchers',
  author: 'bemmoly',
  description: 'Create watchers',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE watchers (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        target_kind text NOT NULL
          CONSTRAINT watchers_target_kind_check CHECK (target_kind IN ('issue')),
        target_id uuid NOT NULL,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX watchers_target_user_key ON watchers (target_kind, target_id, user_id)`);
    await ctx.exec(sql`CREATE INDEX watchers_user_id_idx ON watchers (user_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE watchers`);
  },
});
