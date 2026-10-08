import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The editor works on draft until publish copies it into statuses and
 * transitions and bumps published_version. A null from_status_id is the
 * "Any" transition of the Workflow mock.
 */
export default changeset({
  id: '0003-work-workflows',
  author: 'bemmoly',
  description: 'Create workflows, workflow_statuses and workflow_transitions',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE workflows (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        project_id uuid REFERENCES projects (id) ON DELETE CASCADE,
        origin_id uuid REFERENCES workflows (id) ON DELETE SET NULL,
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
        published_version integer NOT NULL DEFAULT 0 CHECK (published_version >= 0),
        draft jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE INDEX workflows_project_id_idx ON workflows (project_id)`);
    await ctx.exec(sql`
      CREATE TABLE workflow_statuses (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        workflow_id uuid NOT NULL REFERENCES workflows (id) ON DELETE CASCADE,
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
        category text NOT NULL
          CONSTRAINT workflow_statuses_category_check
          CHECK (category IN ('todo', 'in_progress', 'done')),
        color text,
        position integer NOT NULL DEFAULT 0,
        allowed_role_ids uuid[] NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX workflow_statuses_workflow_name_key
        ON workflow_statuses (workflow_id, lower(name))`);
    await ctx.exec(sql`
      CREATE TABLE workflow_transitions (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        workflow_id uuid NOT NULL REFERENCES workflows (id) ON DELETE CASCADE,
        from_status_id uuid REFERENCES workflow_statuses (id) ON DELETE CASCADE,
        to_status_id uuid NOT NULL REFERENCES workflow_statuses (id) ON DELETE CASCADE,
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
        rules jsonb NOT NULL
          DEFAULT '{"conditions": [], "validators": [], "postActions": []}'::jsonb,
        position integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX workflow_transitions_workflow_id_idx ON workflow_transitions (workflow_id)`);
    await ctx.exec(sql`
      CREATE INDEX workflow_transitions_from_status_id_idx
        ON workflow_transitions (from_status_id)`);
    await ctx.exec(sql`
      CREATE INDEX workflow_transitions_to_status_id_idx ON workflow_transitions (to_status_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE workflow_transitions`);
    await ctx.exec(sql`DROP TABLE workflow_statuses`);
    await ctx.exec(sql`DROP TABLE workflows`);
  },
});
