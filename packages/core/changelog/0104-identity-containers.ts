import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Membership and override tables for projects and spaces. The foreign keys to
 * projects and spaces are added by the changesets that create those tables.
 */
export default changeset({
  id: '0104-identity-containers',
  author: 'keerthi',
  description: 'Create project and space membership and capability override tables',
  contexts: ['*'],
  up: async (ctx) => {
    for (const container of ['project', 'space'] as const) {
      const members = sql.identifier(`${container}_members`);
      const overrides = sql.identifier(`${container}_role_capabilities`);
      const column = sql.identifier(`${container}_id`);
      await ctx.exec(sql`
        CREATE TABLE ${members} (
          id uuid PRIMARY KEY DEFAULT uuidv7(),
          ${column} uuid NOT NULL,
          user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
          role_id uuid NOT NULL REFERENCES roles (id) ON DELETE RESTRICT,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )`);
      await ctx.exec(sql`
        CREATE UNIQUE INDEX ${sql.identifier(`${container}_members_${container}_user_key`)}
          ON ${members} (${column}, user_id)`);
      await ctx.exec(sql`
        CREATE INDEX ${sql.identifier(`${container}_members_user_id_idx`)}
          ON ${members} (user_id)`);
      await ctx.exec(sql`
        CREATE TABLE ${overrides} (
          id uuid PRIMARY KEY DEFAULT uuidv7(),
          ${column} uuid NOT NULL,
          role_id uuid NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
          capability text NOT NULL,
          allowed boolean NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )`);
      await ctx.exec(sql`
        CREATE UNIQUE INDEX ${sql.identifier(`${container}_role_capabilities_key`)}
          ON ${overrides} (${column}, role_id, capability)`);
    }
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE space_role_capabilities`);
    await ctx.exec(sql`DROP TABLE project_role_capabilities`);
    await ctx.exec(sql`DROP TABLE space_members`);
    await ctx.exec(sql`DROP TABLE project_members`);
  },
});
