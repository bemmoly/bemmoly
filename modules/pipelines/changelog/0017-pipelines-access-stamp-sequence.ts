import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The access stamp (0010) as a sequence value rather than a counter, written with an upsert:
 * a truncated stamp table (the demo reset empties every Pipelines table) then starts again
 * above every stamp a process may still hold, instead of at a number a stale cache entry
 * already carries.
 */
export default changeset({
  id: '0017-pipelines-access-stamp-sequence',
  author: 'bemmoly',
  description: 'Draw the Pipelines access stamp from a sequence and upsert its row',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`CREATE SEQUENCE pipeline_access_stamp_seq START WITH 1000`);
    await ctx.exec(sql`
      CREATE OR REPLACE FUNCTION pipeline_bump_access_stamp() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO pipeline_access_stamps (id, stamp)
        VALUES (1, nextval('pipeline_access_stamp_seq'))
        ON CONFLICT (id) DO UPDATE
          SET stamp = nextval('pipeline_access_stamp_seq'), updated_at = now();
        RETURN NULL;
      END
      $$`);
    await ctx.exec(sql`
      UPDATE pipeline_access_stamps SET stamp = nextval('pipeline_access_stamp_seq') WHERE id = 1`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`
      CREATE OR REPLACE FUNCTION pipeline_bump_access_stamp() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        UPDATE pipeline_access_stamps SET stamp = stamp + 1, updated_at = now() WHERE id = 1;
        RETURN NULL;
      END
      $$`);
    await ctx.exec(sql`DROP SEQUENCE pipeline_access_stamp_seq`);
  },
});
