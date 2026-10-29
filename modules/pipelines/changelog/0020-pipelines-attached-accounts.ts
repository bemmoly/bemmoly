import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Attached projects: a cloud account can now be one a company already had, attached as it is,
 * beside the ones the landing zone creates. It keeps who Pipelines acts as there, who services
 * run as, and what its last check found missing, so the screen can say what to grant.
 */
export default changeset({
  id: '0020-pipelines-attached-accounts',
  author: 'bemmoly',
  description: 'Let cloud accounts be attached projects with their identities and last check',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE cloud_accounts
        ADD COLUMN origin text NOT NULL DEFAULT 'created'
          CHECK (origin IN ('created', 'attached')),
        ADD COLUMN config jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN problems jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN last_checked_at timestamptz`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE cloud_accounts
        DROP COLUMN origin,
        DROP COLUMN config,
        DROP COLUMN problems,
        DROP COLUMN last_checked_at`);
  },
});
