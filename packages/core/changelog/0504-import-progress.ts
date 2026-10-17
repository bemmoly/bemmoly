import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Progress per project or space, and failures kept to the one that failed. Each chosen
 * container records where its run is (waiting, running, done, failed), its phase and counts,
 * its own checkpoint so Retry carries on from where it stopped, why it failed in plain words,
 * and what it made. A job whose containers did not all finish ends completed_with_errors.
 * import_skips keeps every skipped record, not only the first 500 the report shows, for the
 * CSV download.
 */
export default changeset({
  id: '0504-import-progress',
  author: 'keerthi',
  description: 'Track import progress per container and keep every skipped record',
  preconditions: [
    {
      tableExists: { table: 'import_containers' },
      onFail: 'halt',
      reason: 'progress is kept on the containers 0502 created',
    },
  ],
  up: async (ctx) => {
    await ctx.exec(sql`
      alter table import_containers
        add column run_status text
          constraint import_containers_run_status_check
          check (run_status in ('waiting', 'running', 'done', 'failed')),
        add column run_phase text,
        add column run_done integer not null default 0 check (run_done >= 0),
        add column run_total integer not null default 0 check (run_total >= 0),
        add column run_error text,
        add column run_checkpoint jsonb,
        add column run_result jsonb,
        add column run_finished_at timestamptz`);
    await ctx.exec(sql`
      create index import_containers_job_run_idx on import_containers (job_id, run_status)`);
    await ctx.exec(sql`
      alter table import_jobs drop constraint import_jobs_status_check,
        add constraint import_jobs_status_check check (status in
          ('ready', 'queued', 'running', 'completed', 'completed_with_errors', 'failed',
           'cancelled'))`);
    await ctx.exec(sql`
      create table import_skips (
        id uuid primary key default uuidv7(),
        job_id uuid not null references import_jobs (id) on delete cascade,
        container_id text,
        kind text not null check (char_length(kind) between 1 and 60),
        source text not null check (char_length(source) <= 400),
        reason text not null check (char_length(reason) <= 1000),
        created_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`create index import_skips_job_idx on import_skips (job_id, id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table import_skips`);
    await ctx.exec(sql`
      update import_jobs set status = 'completed' where status = 'completed_with_errors'`);
    await ctx.exec(sql`
      alter table import_jobs drop constraint import_jobs_status_check,
        add constraint import_jobs_status_check check (status in
          ('ready', 'queued', 'running', 'completed', 'failed', 'cancelled'))`);
    await ctx.exec(sql`drop index import_containers_job_run_idx`);
    await ctx.exec(sql`
      alter table import_containers
        drop column run_finished_at, drop column run_result, drop column run_checkpoint,
        drop column run_error, drop column run_total, drop column run_done,
        drop column run_phase, drop column run_status`);
  },
});
