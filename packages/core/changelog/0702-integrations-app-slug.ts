import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * A GitHub App that Bemmoly created from a manifest keeps its slug: the install page's
 * address is built from it, to install the app or change its repositories later. Nullable,
 * so an app entered by hand and the previous minor's inserts are unchanged.
 */
export default changeset({
  id: '0702-integrations-app-slug',
  author: 'shrijayan',
  description: 'Remember the slug of a GitHub App created from a manifest',
  preconditions: [
    {
      tableExists: { table: 'integrations' },
      onFail: 'halt',
      reason: 'the slug extends the integrations table from 0700',
    },
  ],
  up: async (ctx) => {
    await ctx.exec(sql`
      alter table integrations
        add column app_slug text check (app_slug ~ '^[a-z0-9][a-z0-9-]{0,99}$')`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`alter table integrations drop column app_slug`);
  },
});
