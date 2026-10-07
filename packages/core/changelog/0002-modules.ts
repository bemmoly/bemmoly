import { changeset, sql } from '../src/changelog.ts';

export default changeset({
  id: '0002-modules',
  author: 'bemmoly',
  description: 'Create the modules table: enabled state and changelog status per module',
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE modules (
        id text PRIMARY KEY,
        enabled boolean NOT NULL DEFAULT false,
        enabled_at timestamptz,
        disabled_at timestamptz,
        data_removed_at timestamptz,
        version_installed text,
        changelog_state text NOT NULL DEFAULT 'pending'
          CHECK (changelog_state IN ('pending', 'current', 'failed', 'removed')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE modules`);
  },
});
