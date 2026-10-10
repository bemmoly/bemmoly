import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The cross-product graph: any page or issue to any page or issue. Ids carry
 * no foreign key because the kinds live in different modules and Docs boots
 * without Work; the services delete a source's rows when it is rewritten or
 * purged. One row per (source, target, kind), so a page that mentions an
 * issue twice links once. "Referenced in" and backlinks read the target
 * index.
 */
export default changeset({
  id: '0008-docs-links',
  author: 'bemmoly',
  description: 'Create links, the page and issue reference graph',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE links (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        source_kind text NOT NULL
          CONSTRAINT links_source_kind_check CHECK (source_kind IN ('page', 'issue')),
        source_id uuid NOT NULL,
        target_kind text NOT NULL
          CONSTRAINT links_target_kind_check CHECK (target_kind IN ('page', 'issue')),
        target_id uuid NOT NULL,
        kind text NOT NULL
          CONSTRAINT links_kind_check CHECK (kind IN ('mention', 'embed', 'linked')),
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT links_not_self_check
          CHECK (NOT (source_kind = target_kind AND source_id = target_id))
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX links_edge_key
        ON links (source_kind, source_id, target_kind, target_id, kind)`);
    await ctx.exec(sql`
      CREATE INDEX links_target_idx ON links (target_kind, target_id, created_at DESC)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE links`);
  },
});
