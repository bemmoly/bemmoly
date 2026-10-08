import { changeset, sql } from '@bemmoly/core/changelog';

/** query is LQL text; shared_with lists the team ids a filter is shared with. */
export default changeset({
  id: '0010-work-saved-filters',
  author: 'bemmoly',
  description: 'Create saved_filters',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE saved_filters (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        owner_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        project_id uuid REFERENCES projects (id) ON DELETE CASCADE,
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
        query text NOT NULL CHECK (char_length(query) BETWEEN 1 AND 4000),
        shared_with uuid[] NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE INDEX saved_filters_owner_id_idx ON saved_filters (owner_id)`);
    await ctx.exec(sql`CREATE INDEX saved_filters_project_id_idx ON saved_filters (project_id)`);
    await ctx.exec(sql`
      CREATE INDEX saved_filters_shared_with_idx ON saved_filters USING gin (shared_with)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE saved_filters`);
  },
});
