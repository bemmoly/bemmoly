import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Personal access tokens can be limited to some modules, for an MCP client that should only
 * see Work. Null keeps today's meaning: every module the owner can open.
 */
export default changeset({
  id: '0110-identity-api-token-modules',
  author: 'keerthi',
  description: 'Let personal access tokens be limited to some modules',
  up: async (ctx) => {
    await ctx.exec(sql`alter table api_tokens add column modules text[]`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`alter table api_tokens drop column modules`);
  },
});
