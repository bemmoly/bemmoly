import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Files people upload into a module's content, such as images in a page. The bytes live in
 * the object store under storage_key (content addressed, so two uploads of one image share
 * it); this is the index the files API authorizes and serves from.
 */
export default changeset({
  id: '0500-files',
  author: 'keerthi',
  description: 'Add uploaded files',
  up: async (ctx) => {
    await ctx.exec(sql`
      create table files (
        id uuid primary key default uuidv7(),
        target_kind text not null check (target_kind ~ '^[a-z][a-z0-9.-]*$'),
        target_id text not null check (char_length(target_id) between 1 and 200),
        storage_key text not null,
        filename text not null check (char_length(filename) between 1 and 255),
        mime text not null,
        size bigint not null check (size >= 0),
        sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
        uploaded_by uuid references users (id) on delete set null,
        created_at timestamptz not null default now()
      )`);
    await ctx.exec(sql`create index files_target_idx on files (target_kind, target_id)`);
    await ctx.exec(sql`create index files_storage_key_idx on files (storage_key)`);
    await ctx.exec(sql`create index files_created_at_idx on files (created_at)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table files`);
  },
});
