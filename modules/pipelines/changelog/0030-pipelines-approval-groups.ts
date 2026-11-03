import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Approval groups: named sets of people ("Production approvers") that an environment's
 * approval rule asks, never job titles. Who is in a group decides who may approve, so both
 * tables bump the access stamp like the other tables that decide access.
 */
export default changeset({
  id: '0030-pipelines-approval-groups',
  author: 'bemmoly',
  description: 'Create approval groups and their members',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE pipeline_approval_groups (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
        description text,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_approval_groups_name_key
        ON pipeline_approval_groups (lower(name))`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_approval_group_members (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        group_id uuid NOT NULL REFERENCES pipeline_approval_groups (id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        added_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_approval_group_members_key
        ON pipeline_approval_group_members (group_id, user_id)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_approval_group_members_user_idx
        ON pipeline_approval_group_members (user_id)`);
    for (const table of ['pipeline_approval_groups', 'pipeline_approval_group_members']) {
      await ctx.exec(sql`
        CREATE TRIGGER ${sql.identifier(`${table}_access_stamp`)}
          AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON ${sql.identifier(table)}
          FOR EACH STATEMENT EXECUTE FUNCTION pipeline_bump_access_stamp()`);
    }
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE pipeline_approval_group_members`);
    await ctx.exec(sql`DROP TABLE pipeline_approval_groups`);
  },
});
