import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * The last good models.dev catalog, from a live fetch (with its ETag) or an admin's upload.
 * Exactly one row is current; older rows are pruned by the refresh job.
 */
export default changeset({
  id: '0403-ai-catalog-snapshots',
  author: 'keerthi',
  description: 'Add stored AI catalog snapshots with their ETag',
  up: async (ctx) => {
    await ctx.exec(sql`
      create table ai_catalog_snapshots (
        id uuid primary key default uuidv7(),
        source text not null
          constraint ai_catalog_snapshots_source_check check (source in ('live', 'uploaded')),
        etag text,
        fetched_at timestamptz not null default now(),
        data jsonb not null,
        provider_count integer not null default 0,
        model_count integer not null default 0,
        is_current boolean not null default false,
        created_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`
      create unique index ai_catalog_snapshots_current_idx on ai_catalog_snapshots (is_current)
        where is_current`);
    await ctx.exec(sql`
      create index ai_catalog_snapshots_fetched_at_idx on ai_catalog_snapshots (fetched_at desc)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table ai_catalog_snapshots`);
  },
});
