import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The key is written by the issue service under the project counter lock,
 * never generated here, so it stays unique and gap free across replicas.
 * pg_trgm is a trusted extension, so the database owner can create it; the
 * container entrypoint also does, for installs whose owner cannot.
 */
export default changeset({
  id: '0006-work-issues',
  author: 'bemmoly',
  description: 'Create issues with its search, trigram, rank and custom field indexes',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await ctx.exec(sql`
      CREATE TABLE issues (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        number integer NOT NULL CHECK (number > 0),
        key text NOT NULL,
        type_id uuid NOT NULL REFERENCES issue_types (id) ON DELETE RESTRICT,
        title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
        description jsonb,
        description_text text NOT NULL DEFAULT '',
        status_id uuid NOT NULL REFERENCES workflow_statuses (id) ON DELETE RESTRICT,
        priority text NOT NULL DEFAULT 'medium'
          CONSTRAINT issues_priority_check
          CHECK (priority IN ('highest', 'high', 'medium', 'low', 'lowest')),
        assignee_id uuid REFERENCES users (id) ON DELETE SET NULL,
        reporter_id uuid REFERENCES users (id) ON DELETE SET NULL,
        parent_id uuid REFERENCES issues (id) ON DELETE SET NULL,
        sprint_id uuid REFERENCES sprints (id) ON DELETE SET NULL,
        estimate numeric(10, 2) CHECK (estimate >= 0),
        due_at date,
        fix_version_id uuid REFERENCES versions (id) ON DELETE SET NULL,
        component_id uuid REFERENCES components (id) ON DELETE SET NULL,
        custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
        rank text NOT NULL CHECK (rank ~ '^[a-z]*[b-z]$'),
        search_vector tsvector,
        status_changed_at timestamptz NOT NULL DEFAULT now(),
        resolved_at timestamptz,
        deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(
      sql`CREATE UNIQUE INDEX issues_project_number_key ON issues (project_id, number)`,
    );
    await ctx.exec(sql`CREATE UNIQUE INDEX issues_key_key ON issues (key)`);
    await ctx.exec(sql`
      CREATE INDEX issues_board_rank_idx ON issues (project_id, rank) WHERE deleted_at IS NULL`);
    await ctx.exec(sql`
      CREATE INDEX issues_project_status_idx ON issues (project_id, status_id)
        WHERE deleted_at IS NULL`);
    await ctx.exec(sql`
      CREATE INDEX issues_sprint_id_idx ON issues (sprint_id) WHERE deleted_at IS NULL`);
    await ctx.exec(sql`
      CREATE INDEX issues_assignee_id_idx ON issues (assignee_id) WHERE deleted_at IS NULL`);
    await ctx.exec(sql`
      CREATE INDEX issues_reporter_id_idx ON issues (reporter_id) WHERE deleted_at IS NULL`);
    await ctx.exec(sql`CREATE INDEX issues_parent_id_idx ON issues (parent_id)`);
    await ctx.exec(sql`CREATE INDEX issues_type_id_idx ON issues (type_id)`);
    await ctx.exec(sql`CREATE INDEX issues_fix_version_id_idx ON issues (fix_version_id)`);
    await ctx.exec(sql`CREATE INDEX issues_component_id_idx ON issues (component_id)`);
    await ctx.exec(sql`CREATE INDEX issues_custom_fields_idx ON issues USING gin (custom_fields)`);
    await ctx.exec(sql`CREATE INDEX issues_search_vector_idx ON issues USING gin (search_vector)`);
    await ctx.exec(sql`
      CREATE INDEX issues_title_trgm_idx ON issues USING gin (title gin_trgm_ops)`);
    await ctx.exec(sql`CREATE INDEX issues_key_trgm_idx ON issues USING gin (key gin_trgm_ops)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE issues`);
  },
});
