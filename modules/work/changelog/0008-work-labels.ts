import { changeset, sql } from '@bemmoly/core/changelog';

export default changeset({
  id: '0008-work-labels',
  author: 'bemmoly',
  description: 'Create labels and issue_labels',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE labels (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
        color text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX labels_project_name_key ON labels (project_id, lower(name))`);
    await ctx.exec(sql`
      CREATE TABLE issue_labels (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        issue_id uuid NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
        label_id uuid NOT NULL REFERENCES labels (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX issue_labels_issue_label_key ON issue_labels (issue_id, label_id)`);
    await ctx.exec(sql`CREATE INDEX issue_labels_label_id_idx ON issue_labels (label_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE issue_labels`);
    await ctx.exec(sql`DROP TABLE labels`);
  },
});
