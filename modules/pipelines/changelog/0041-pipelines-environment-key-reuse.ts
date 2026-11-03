import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * An environment's ID is the person's to choose and change, so a removed environment must not
 * hold its ID for ever: only live environments need distinct keys. Removed ones keep their
 * history (deployments still point at them) without blocking a new "production".
 */
export default changeset({
  id: '0041-pipelines-environment-key-reuse',
  author: 'bemmoly',
  description: 'Let a new environment reuse the key of a removed one',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_environments_live_key_key
        ON pipeline_environments (key) WHERE archived_at IS NULL`);
    await ctx.exec(sql`DROP INDEX pipeline_environments_key_key`);
  },
  down: async (ctx) => {
    // The previous release wants every key distinct; a removed one that clashes gets a suffix.
    await ctx.exec(sql`
      UPDATE pipeline_environments e
      SET key = left(e.key, 54) || '-' || substr(md5(e.id::text), 1, 8)
      WHERE e.archived_at IS NOT NULL
        AND EXISTS (SELECT 1 FROM pipeline_environments o WHERE o.key = e.key AND o.id <> e.id)`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_environments_key_key ON pipeline_environments (key)`);
    await ctx.exec(sql`DROP INDEX pipeline_environments_live_key_key`);
  },
});
