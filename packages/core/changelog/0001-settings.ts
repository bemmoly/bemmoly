import { changeset, sql } from '../src/changelog.ts';

export default changeset({
  id: '0001-settings',
  author: 'bemmoly',
  description: 'Create the settings table for admin-edited configuration, secrets encrypted',
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE settings (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        key text NOT NULL,
        value jsonb,
        is_secret boolean NOT NULL DEFAULT false,
        encrypted text,
        updated_by text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT settings_secret_shape CHECK (
          (is_secret AND value IS NULL) OR (NOT is_secret AND encrypted IS NULL)
        )
      )`);
    await ctx.exec(sql`CREATE UNIQUE INDEX settings_key_idx ON settings (key)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE settings`);
  },
});
