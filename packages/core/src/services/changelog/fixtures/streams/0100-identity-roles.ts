import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

export default changeset({
  id: '0100-identity-roles',
  author: 'keerthi',
  description: 'Create roles and the role_capabilities matrix with org locks',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE roles (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        key text NOT NULL,
        name text NOT NULL,
        is_system boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE UNIQUE INDEX roles_key_key ON roles (key)`);
    await ctx.exec(sql`
      CREATE TABLE role_capabilities (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        role_id uuid NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
        capability text NOT NULL,
        allowed boolean NOT NULL,
        locked_by_org boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX role_capabilities_role_capability_key
        ON role_capabilities (role_id, capability)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE role_capabilities`);
    await ctx.exec(sql`DROP TABLE roles`);
  },
});
