import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Initiatives: programs of work above epics, owned by the workspace rather than a project, so
 * one can gather epics from many projects and teams. An epic may sit in more than one; a
 * deleted epic or initiative takes its links with it. Archiving keeps the row and its links.
 * The live list pages by name, so its index holds live rows only.
 */
export default changeset({
  id: '0035-work-initiatives',
  author: 'bemmoly',
  description: 'Create initiatives and initiative_epics',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE initiatives (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        name text NOT NULL,
        description text,
        owner_id uuid REFERENCES users (id) ON DELETE SET NULL,
        start_at date,
        target_at date,
        archived_at timestamptz,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT initiatives_dates_check CHECK (start_at IS NULL OR target_at IS NULL
          OR start_at <= target_at)
      )`);
    await ctx.exec(sql`
      CREATE INDEX initiatives_live_name_idx ON initiatives (lower(name), id)
        WHERE archived_at IS NULL`);
    await ctx.exec(sql`
      CREATE TABLE initiative_epics (
        initiative_id uuid NOT NULL REFERENCES initiatives (id) ON DELETE CASCADE,
        epic_id uuid NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
        added_by uuid REFERENCES users (id) ON DELETE SET NULL,
        added_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (initiative_id, epic_id)
      )`);
    await ctx.exec(sql`CREATE INDEX initiative_epics_epic_id_idx ON initiative_epics (epic_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE IF EXISTS initiative_epics`);
    await ctx.exec(sql`DROP TABLE IF EXISTS initiatives`);
  },
});
