import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * An epic keeps its colour, so the Board lane, the Backlog rail and the
 * Issue page all paint it the same. The value is a palette name
 * ('epic-1' … 'epic-8') the theme maps to a colour, never a hex, so it
 * follows light and dark. Existing epics get the palette in rank order,
 * per project, the order the screens used to colour them by position.
 */
export default changeset({
  id: '0023-work-epic-color',
  author: 'bemmoly',
  description: 'Store a palette colour on epics',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE issues ADD COLUMN IF NOT EXISTS color text
        CONSTRAINT issues_color_check CHECK (color IS NULL OR color ~ '^epic-[1-8]$')`);
    await ctx.exec(sql`
      UPDATE issues i SET color = 'epic-' || ((ranked.n - 1) % 8 + 1)
      FROM (
        SELECT e.id, row_number() OVER (PARTITION BY e.project_id ORDER BY e.rank COLLATE "C", e.id) AS n
        FROM issues e
        JOIN issue_types t ON t.id = e.type_id AND t.level = 'epic'
      ) ranked
      WHERE i.id = ranked.id AND i.color IS NULL`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`ALTER TABLE issues DROP COLUMN IF EXISTS color`);
  },
});
