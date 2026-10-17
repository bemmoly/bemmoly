import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * The importer's chooser. import_containers holds what a connection found, one row per
 * project, space or file, so a site with 1,500 projects is listed a page at a time, searched
 * by key, name and lead (trigram index on the name), counted on demand, and picked through a
 * selection kept on the rows (selected, with selected_before for Undo after a clear).
 * Imported-before and key-in-use are worked out at connect time by the module that owns the
 * target. Jobs connected before this change keep their list: their discovery's containers are
 * copied in, ticked as their plan had them.
 */
export default changeset({
  id: '0502-import-containers',
  author: 'keerthi',
  description: 'List what an import connection found as rows, for search, counts and selection',
  preconditions: [
    {
      tableExists: { table: 'import_jobs' },
      onFail: 'halt',
      reason: 'the containers belong to an import job',
    },
  ],
  up: async (ctx) => {
    await ctx.exec(sql`create extension if not exists pg_trgm`);
    await ctx.exec(sql`
      create table import_containers (
        id uuid primary key default uuidv7(),
        job_id uuid not null references import_jobs (id) on delete cascade,
        source_id text not null check (char_length(source_id) between 1 and 400),
        position integer not null check (position >= 0),
        key text,
        name text not null,
        kind text not null,
        type text,
        lead_name text,
        access text not null default 'ok'
          constraint import_containers_access_check check (access in ('ok', 'none')),
        count integer check (count >= 0),
        counted_at timestamptz,
        imported_target_id uuid,
        imported_key text,
        imported_name text,
        imported_at timestamptz,
        key_in_use boolean not null default false,
        selected boolean not null default false,
        selected_before boolean,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`
      create unique index import_containers_job_source_key
        on import_containers (job_id, source_id)`);
    await ctx.exec(sql`
      create index import_containers_job_position_idx on import_containers (job_id, position)`);
    await ctx.exec(
      sql`create index import_containers_job_key_idx on import_containers (job_id, key)`,
    );
    await ctx.exec(sql`
      create index import_containers_name_trgm_idx
        on import_containers using gin (name gin_trgm_ops)`);
    await ctx.exec(sql`
      insert into import_containers (job_id, source_id, position, key, name, kind, count,
        counted_at, selected)
      select j.id, c.value->>'id', (c.ordinality - 1)::int, c.value->>'key',
        coalesce(c.value->>'name', c.value->>'id'), coalesce(c.value->>'kind', 'project'),
        (c.value->>'count')::int,
        case when c.value->>'count' is null then null else j.created_at end,
        coalesce(j.plan->'containers' ? (c.value->>'id'), false)
      from import_jobs j,
        jsonb_array_elements(coalesce(j.discovery->'containers', '[]'::jsonb))
          with ordinality as c(value, ordinality)
      where c.value->>'id' is not null
      on conflict (job_id, source_id) do nothing`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table import_containers`);
  },
});
