import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Single-use links an MCP client sends a file's bytes to (ADR 0048). The token is stored as
 * its sha256 only. credential_id is the personal access token or OAuth connection that asked
 * for the link, checked again when it is used.
 */
export default changeset({
  id: '0505-file-upload-links',
  author: 'shrijayan',
  description: 'Add single-use file upload links',
  up: async (ctx) => {
    await ctx.exec(sql`
      create table file_upload_links (
        id uuid primary key default uuidv7(),
        token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
        user_id uuid not null references users (id) on delete cascade,
        credential_id uuid not null,
        target_kind text not null check (target_kind ~ '^[a-z][a-z0-9.-]*$'),
        target_id text not null check (char_length(target_id) between 1 and 200),
        filename text check (char_length(filename) between 1 and 255),
        expires_at timestamptz not null,
        used_at timestamptz,
        file_id uuid references files (id) on delete set null,
        created_at timestamptz not null default now()
      )`);
    await ctx.exec(
      sql`create unique index file_upload_links_token_hash_key on file_upload_links (token_hash)`,
    );
    await ctx.exec(
      sql`create index file_upload_links_expires_at_idx on file_upload_links (expires_at)`,
    );
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table file_upload_links`);
  },
});
