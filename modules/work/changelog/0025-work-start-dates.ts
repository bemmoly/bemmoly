import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The roadmap draws a bar from a start to a target: an issue's due date and a
 * version's release date already exist, so only the start is new. Both are
 * plain dates, nullable, with no default, so every existing row reads as "not
 * scheduled" and the previous release, which never names the column, keeps
 * working. The roadmap reads them per project, through indexes that exist.
 */
export default changeset({
  id: '0025-work-start-dates',
  author: 'bemmoly',
  description: 'Add a start date to issues and versions for the roadmap',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`ALTER TABLE issues ADD COLUMN IF NOT EXISTS start_at date`);
    await ctx.exec(sql`ALTER TABLE versions ADD COLUMN IF NOT EXISTS start_at date`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`ALTER TABLE versions DROP COLUMN IF EXISTS start_at`);
    await ctx.exec(sql`ALTER TABLE issues DROP COLUMN IF EXISTS start_at`);
  },
});
