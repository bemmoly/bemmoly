import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * The importer's options and mapping. Each chosen container gets where it goes: a new project
 * or space with a key the admin may edit, an existing one to bring it into, or the one an
 * earlier import made (target_request is what the admin asked for, the other target columns
 * what the plan made of it, with the error that blocks Review when a new key is taken).
 * import_people is the people pass the plan makes: everyone the chosen containers name,
 * matched by email to a member, kept as a placeholder, or set by the admin by hand.
 */
export default changeset({
  id: '0503-import-plan-options',
  author: 'keerthi',
  description: 'Add import targets per container and the people an import plan found',
  preconditions: [
    {
      tableExists: { table: 'import_containers' },
      onFail: 'halt',
      reason: 'targets are kept on the containers 0502 created',
    },
  ],
  up: async (ctx) => {
    await ctx.exec(sql`
      alter table import_containers
        add column target_request jsonb,
        add column target_mode text
          constraint import_containers_target_mode_check
          check (target_mode in ('create', 'existing', 'update')),
        add column target_key text,
        add column target_id uuid,
        add column target_name text,
        add column target_note text,
        add column target_error text`);
    await ctx.exec(sql`
      create table import_people (
        id uuid primary key default uuidv7(),
        job_id uuid not null references import_jobs (id) on delete cascade,
        source_id text not null check (char_length(source_id) between 1 and 400),
        name text not null,
        email text,
        match text not null
          constraint import_people_match_check check (match in ('matched', 'placeholder', 'hidden')),
        user_id uuid references users (id) on delete set null,
        override text
          constraint import_people_override_check check (override in ('user', 'placeholder')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`
      create unique index import_people_job_source_key on import_people (job_id, source_id)`);
    await ctx.exec(sql`
      create index import_people_job_name_idx on import_people (job_id, lower(name), id)`);
    await ctx.exec(sql`create index import_people_user_id_idx on import_people (user_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table import_people`);
    await ctx.exec(sql`
      alter table import_containers
        drop column target_error, drop column target_note, drop column target_name,
        drop column target_id, drop column target_key, drop column target_mode,
        drop column target_request`);
  },
});
