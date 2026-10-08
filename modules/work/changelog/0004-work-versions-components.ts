import { changeset, sql } from '@bemmoly/core/changelog';

export default changeset({
  id: '0004-work-versions-components',
  author: 'bemmoly',
  description: 'Create versions and components',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE versions (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
        description text,
        release_at date,
        status text NOT NULL DEFAULT 'unreleased'
          CONSTRAINT versions_status_check
          CHECK (status IN ('unreleased', 'released', 'archived')),
        released_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX versions_project_name_key ON versions (project_id, lower(name))`);
    await ctx.exec(sql`
      CREATE TABLE components (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
        description text,
        lead_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX components_project_name_key ON components (project_id, lower(name))`);
    await ctx.exec(sql`CREATE INDEX components_lead_user_id_idx ON components (lead_user_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE components`);
    await ctx.exec(sql`DROP TABLE versions`);
  },
});
