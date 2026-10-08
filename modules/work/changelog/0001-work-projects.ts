import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The kernel's project_members and project_role_capabilities tables were
 * created without their foreign key to projects, which is owned here; this
 * changeset adds it and its down removes it before the table goes.
 */
export default changeset({
  id: '0001-work-projects',
  author: 'bemmoly',
  description: 'Create projects and project_counters; link the kernel membership tables',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE projects (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        key text NOT NULL
          CONSTRAINT projects_key_check CHECK (key ~ '^[A-Z][A-Z0-9]{1,9}$'),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
        description text,
        team_id uuid REFERENCES teams (id) ON DELETE SET NULL,
        method text NOT NULL DEFAULT 'scrum'
          CONSTRAINT projects_method_check CHECK (method IN ('scrum', 'kanban')),
        scheme_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
        default_space_id uuid,
        archived_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE UNIQUE INDEX projects_key_key ON projects (key)`);
    await ctx.exec(sql`CREATE INDEX projects_team_id_idx ON projects (team_id)`);
    await ctx.exec(sql`
      CREATE TABLE project_counters (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        next_number integer NOT NULL DEFAULT 1 CHECK (next_number > 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX project_counters_project_id_key ON project_counters (project_id)`);
    await ctx.exec(sql`
      ALTER TABLE project_members
        ADD CONSTRAINT project_members_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE`);
    await ctx.exec(sql`
      ALTER TABLE project_role_capabilities
        ADD CONSTRAINT project_role_capabilities_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE project_role_capabilities
        DROP CONSTRAINT project_role_capabilities_project_id_fkey`);
    await ctx.exec(
      sql`ALTER TABLE project_members DROP CONSTRAINT project_members_project_id_fkey`,
    );
    await ctx.exec(sql`DROP TABLE project_counters`);
    await ctx.exec(sql`DROP TABLE projects`);
  },
});
