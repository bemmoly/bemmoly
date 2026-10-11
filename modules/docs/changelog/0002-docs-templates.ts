import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * A template is a ProseMirror snapshot plus metadata fields (the RFC's
 * "status" and "deciders", say) the page form asks for. space_id null is an
 * org-wide template; built-in ones carry a key so the seed can find them
 * again and never duplicate them on a rerun.
 */
export default changeset({
  id: '0002-docs-templates',
  author: 'bemmoly',
  description: 'Create templates',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE templates (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        space_id uuid REFERENCES spaces (id) ON DELETE CASCADE,
        key text CONSTRAINT templates_key_check CHECK (key ~ '^[a-z][a-z0-9-]{1,40}$'),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
        description text,
        icon text,
        category text,
        snapshot jsonb NOT NULL,
        fields jsonb NOT NULL DEFAULT '[]'::jsonb,
        is_builtin boolean NOT NULL DEFAULT false,
        position integer NOT NULL DEFAULT 0,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        archived_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX templates_builtin_key_key ON templates (key)
        WHERE space_id IS NULL AND key IS NOT NULL`);
    await ctx.exec(sql`
      CREATE INDEX templates_space_position_idx ON templates (space_id, position)
        WHERE archived_at IS NULL`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE templates`);
  },
});
