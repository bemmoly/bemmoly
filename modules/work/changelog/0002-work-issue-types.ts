import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * A null project_id is an org default; a project row with origin_id is a
 * full copy of that default, which is what "Reset to org default" and
 * "View diff" act on. Keys are unique per project and once among defaults.
 */
export default changeset({
  id: '0002-work-issue-types',
  author: 'bemmoly',
  description: 'Create issue_types, fields and issue_type_fields',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE issue_types (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        project_id uuid REFERENCES projects (id) ON DELETE CASCADE,
        origin_id uuid REFERENCES issue_types (id) ON DELETE SET NULL,
        key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{0,39}$'),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
        description text,
        icon text,
        color text,
        level text NOT NULL DEFAULT 'standard'
          CONSTRAINT issue_types_level_check CHECK (level IN ('epic', 'standard', 'subtask')),
        position integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX issue_types_project_key_key ON issue_types (project_id, key)
        WHERE project_id IS NOT NULL`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX issue_types_default_key_key ON issue_types (key)
        WHERE project_id IS NULL`);
    await ctx.exec(sql`
      CREATE TABLE fields (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        project_id uuid REFERENCES projects (id) ON DELETE CASCADE,
        origin_id uuid REFERENCES fields (id) ON DELETE SET NULL,
        key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{0,39}$'),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
        kind text NOT NULL
          CONSTRAINT fields_kind_check CHECK (kind IN (
            'text', 'richtext', 'number', 'select', 'multiselect', 'user', 'date', 'datetime',
            'url', 'doc')),
        options jsonb NOT NULL DEFAULT '[]'::jsonb,
        filterable boolean NOT NULL DEFAULT false,
        ai_fill boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX fields_project_key_key ON fields (project_id, key)
        WHERE project_id IS NOT NULL`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX fields_default_key_key ON fields (key) WHERE project_id IS NULL`);
    await ctx.exec(sql`
      CREATE TABLE issue_type_fields (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        issue_type_id uuid NOT NULL REFERENCES issue_types (id) ON DELETE CASCADE,
        field_id uuid NOT NULL REFERENCES fields (id) ON DELETE CASCADE,
        required boolean NOT NULL DEFAULT false,
        on_card boolean NOT NULL DEFAULT false,
        position integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX issue_type_fields_type_field_key
        ON issue_type_fields (issue_type_id, field_id)`);
    await ctx.exec(
      sql`CREATE INDEX issue_type_fields_field_id_idx ON issue_type_fields (field_id)`,
    );
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE issue_type_fields`);
    await ctx.exec(sql`DROP TABLE fields`);
    await ctx.exec(sql`DROP TABLE issue_types`);
  },
});
