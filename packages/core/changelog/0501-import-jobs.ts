import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Importers (tech design §17). import_jobs is one connection to a source and every run of it:
 * the encrypted credentials (write-only, never read back to a client), what was discovered and
 * planned, live progress, the checkpoint a resumed run starts from, and the report.
 * import_mappings ties an external id, per source site, to the Bemmoly row it became, so a
 * second run updates rather than duplicates; meta keeps what a run needs to tell an untouched
 * import from one edited here since.
 */
export default changeset({
  id: '0501-import-jobs',
  author: 'keerthi',
  description: 'Add import jobs and the external id mappings that make re-runs safe',
  preconditions: [
    {
      tableExists: { table: 'users' },
      onFail: 'halt',
      reason: 'an import is started by a person; the identity changesets run first',
    },
  ],
  up: async (ctx) => {
    await ctx.exec(sql`
      create table import_jobs (
        id uuid primary key default uuidv7(),
        source text not null constraint import_jobs_source_check
          check (source ~ '^[a-z][a-z0-9-]{1,39}$'),
        site text not null,
        connection jsonb not null default '{}'::jsonb,
        credentials text,
        status text not null default 'ready'
          constraint import_jobs_status_check check (status in
            ('ready', 'queued', 'running', 'completed', 'failed', 'cancelled')),
        discovery jsonb,
        plan jsonb,
        phase text,
        progress_done integer not null default 0 check (progress_done >= 0),
        progress_total integer not null default 0 check (progress_total >= 0),
        checkpoint jsonb,
        report jsonb not null default '{}'::jsonb,
        error text,
        runs integer not null default 0 check (runs >= 0),
        created_by uuid references users (id) on delete set null,
        started_at timestamptz,
        finished_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`create index import_jobs_created_idx on import_jobs (id desc)`);
    await ctx.exec(sql`
      create table import_mappings (
        id uuid primary key default uuidv7(),
        source text not null,
        site text not null,
        kind text not null check (char_length(kind) between 1 and 60),
        source_id text not null check (char_length(source_id) between 1 and 400),
        target_id uuid not null,
        meta jsonb not null default '{}'::jsonb,
        job_id uuid references import_jobs (id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`
      create unique index import_mappings_source_key
        on import_mappings (source, site, kind, source_id)`);
    await ctx.exec(sql`create index import_mappings_target_idx on import_mappings (target_id)`);
    await ctx.exec(sql`create index import_mappings_job_id_idx on import_mappings (job_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table import_mappings`);
    await ctx.exec(sql`drop table import_jobs`);
  },
});
