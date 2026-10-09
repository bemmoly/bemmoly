import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The kernel's space_members and space_role_capabilities tables were created
 * without their foreign key to spaces, which is owned here; this changeset
 * adds it and its down removes it before the table goes. project_id has no
 * foreign key on purpose: Docs boots with Work disabled, when projects does
 * not exist. home_page_id gets its key once pages exists.
 */
export default changeset({
  id: '0001-docs-spaces',
  author: 'bemmoly',
  description: 'Create spaces; link the kernel space membership tables',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE spaces (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        key text NOT NULL
          CONSTRAINT spaces_key_check CHECK (key ~ '^[A-Z][A-Z0-9]{1,9}$'),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
        description text,
        icon text,
        color text,
        team_id uuid REFERENCES teams (id) ON DELETE SET NULL,
        project_id uuid,
        ai_excluded boolean NOT NULL DEFAULT false,
        home_page_id uuid,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        archived_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE UNIQUE INDEX spaces_key_key ON spaces (key)`);
    await ctx.exec(sql`CREATE INDEX spaces_team_id_idx ON spaces (team_id)`);
    await ctx.exec(sql`
      CREATE INDEX spaces_project_id_idx ON spaces (project_id) WHERE project_id IS NOT NULL`);
    await ctx.exec(sql`
      ALTER TABLE space_members
        ADD CONSTRAINT space_members_space_id_fkey
        FOREIGN KEY (space_id) REFERENCES spaces (id) ON DELETE CASCADE`);
    await ctx.exec(sql`
      ALTER TABLE space_role_capabilities
        ADD CONSTRAINT space_role_capabilities_space_id_fkey
        FOREIGN KEY (space_id) REFERENCES spaces (id) ON DELETE CASCADE`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE space_role_capabilities DROP CONSTRAINT space_role_capabilities_space_id_fkey`);
    await ctx.exec(sql`ALTER TABLE space_members DROP CONSTRAINT space_members_space_id_fkey`);
    await ctx.exec(sql`DROP TABLE spaces`);
  },
});
