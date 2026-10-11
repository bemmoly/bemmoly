import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Chunks of issues and pages as vectors, where in the record each came from (location: a
 * heading and anchor, a description or a comment, for citations), and the access metadata
 * retrieval filters on (module, project or space, author) so excluded and unreadable content
 * never comes back. The column is an untyped vector because the size follows the embedding
 * model; each common size has a partial HNSW index over the cast, and a query uses it with
 * `where dimensions = N order by embedding::vector(N) <=> $query`. Switching models reindexes.
 * pgvector ships in the pgvector/pgvector Postgres image every install runs.
 */
export default changeset({
  id: '0406-ai-embeddings',
  author: 'keerthi',
  description: 'Add pgvector embeddings with access metadata and HNSW indexes',
  up: async (ctx) => {
    await ctx.exec(sql`create extension if not exists vector`);
    await ctx.exec(sql`
      create table embeddings (
        id uuid primary key default uuidv7(),
        target_kind text not null,
        target_id text not null,
        chunk_index integer not null,
        text text not null,
        location jsonb,
        embedding vector not null,
        dimensions integer not null,
        provider_id uuid references ai_providers (id) on delete set null,
        model text not null,
        module_id text not null,
        space_id uuid,
        project_id uuid,
        author_id uuid references users (id) on delete set null,
        content_hash text not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint embeddings_dimensions_check check (vector_dims(embedding) = dimensions)
      )`);
    await ctx.exec(sql`
      create unique index embeddings_target_chunk_key
        on embeddings (target_kind, target_id, model, chunk_index)`);
    await ctx.exec(sql`create index embeddings_space_id_idx on embeddings (space_id)`);
    await ctx.exec(sql`create index embeddings_project_id_idx on embeddings (project_id)`);
    // One partial HNSW index per common vector size (written out: no SQL built from strings).
    await ctx.exec(sql`
      create index embeddings_hnsw_384_idx on embeddings
        using hnsw ((embedding::vector(384)) vector_cosine_ops) where dimensions = 384`);
    await ctx.exec(sql`
      create index embeddings_hnsw_512_idx on embeddings
        using hnsw ((embedding::vector(512)) vector_cosine_ops) where dimensions = 512`);
    await ctx.exec(sql`
      create index embeddings_hnsw_768_idx on embeddings
        using hnsw ((embedding::vector(768)) vector_cosine_ops) where dimensions = 768`);
    await ctx.exec(sql`
      create index embeddings_hnsw_1024_idx on embeddings
        using hnsw ((embedding::vector(1024)) vector_cosine_ops) where dimensions = 1024`);
    await ctx.exec(sql`
      create index embeddings_hnsw_1536_idx on embeddings
        using hnsw ((embedding::vector(1536)) vector_cosine_ops) where dimensions = 1536`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`drop table embeddings`);
  },
});
