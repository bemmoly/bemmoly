import type { SqlClient } from '../../../clients/postgres.ts';
import type { RetrievalLocation } from '../../../contracts/retrieval.ts';

/*
 * The embeddings table, read and written only here. A record's chunks are replaced as a whole
 * in one transaction; a chunk whose text is unchanged keeps its vector (matched by content
 * hash), so an edit re-embeds only what changed. The vector column is untyped; a query casts
 * it to its size so the partial HNSW index for that size is used.
 */

export interface StoredChunk {
  chunkIndex: number;
  text: string;
  location: RetrievalLocation;
  contentHash: string;
  authorId: string | null;
  /** The vector as pgvector text: "[0.1,0.2,…]". */
  vector: string;
}

export interface TargetScope {
  kind: string;
  moduleId: string;
  targetId: string;
  container: 'space' | 'project';
  containerId: string;
}

export interface ModelStamp {
  providerId: string;
  modelId: string;
  dimensions: number;
}

export const toVector = (values: readonly number[]): string => `[${values.join(',')}]`;

/** Vectors already stored for a record under this model, by content hash. */
export async function existingVectors(
  sql: SqlClient,
  kind: string,
  targetId: string,
  modelId: string,
): Promise<Map<string, string>> {
  const rows = await sql<{ content_hash: string; vector: string }[]>`
    select content_hash, embedding::text as vector from embeddings
    where target_kind = ${kind} and target_id = ${targetId} and model = ${modelId}`;
  return new Map(rows.map((row) => [row.content_hash, row.vector]));
}

/** Replaces every chunk of the record (every model's) with these. */
export async function replaceTarget(
  sql: SqlClient,
  scope: TargetScope,
  model: ModelStamp,
  chunks: readonly StoredChunk[],
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`delete from embeddings where target_kind = ${scope.kind} and target_id = ${scope.targetId}`;
    const spaceId = scope.container === 'space' ? scope.containerId : null;
    const projectId = scope.container === 'project' ? scope.containerId : null;
    for (const chunk of chunks) {
      await tx`
        insert into embeddings (target_kind, target_id, chunk_index, text, location, embedding,
          dimensions, provider_id, model, module_id, space_id, project_id, author_id, content_hash)
        values (${scope.kind}, ${scope.targetId}, ${chunk.chunkIndex}, ${chunk.text},
          ${JSON.stringify(chunk.location)}::text::jsonb, ${chunk.vector}::vector, ${model.dimensions},
          (select id from ai_providers where id::text = ${model.providerId}), ${model.modelId},
          ${scope.moduleId}, ${spaceId}::uuid, ${projectId}::uuid,
          (select id from users where id::text = ${chunk.authorId ?? ''}), ${chunk.contentHash})`;
    }
  });
}

export async function deleteTargets(
  sql: SqlClient,
  kind: string,
  targetIds: readonly string[],
): Promise<number> {
  if (targetIds.length === 0) return 0;
  const rows = await sql`
    delete from embeddings where target_kind = ${kind} and target_id = any(${targetIds}::text[])
    returning 1`;
  return rows.length;
}

export interface ExclusionSweep {
  excludedSpaceIds: readonly string[];
  excludedProjectIds: readonly string[];
  optedOutUserIds: readonly string[];
  /** Rows of any other model are stale once the embedding role points elsewhere. */
  currentModelId: string | null;
}

/** Drops what may no longer be embedded: excluded containers, opted-out authors, old models. */
export async function sweepExcluded(sql: SqlClient, sweep: ExclusionSweep): Promise<number> {
  const rows = await sql`
    delete from embeddings
    where space_id = any(${sweep.excludedSpaceIds as string[]}::uuid[])
      or project_id = any(${sweep.excludedProjectIds as string[]}::uuid[])
      or author_id = any(${sweep.optedOutUserIds as string[]}::uuid[])
      or (${sweep.currentModelId}::text is not null and model <> ${sweep.currentModelId}::text)
    returning 1`;
  return rows.length;
}

export async function deleteAll(sql: SqlClient): Promise<number> {
  const rows = await sql`delete from embeddings returning 1`;
  return rows.length;
}

export interface NearestQuery {
  kind: string;
  container: 'space' | 'project';
  /** Null: every container. */
  containerIds: readonly string[] | null;
  modelId: string;
  vector: readonly number[];
  limit: number;
  excludedContainerIds: readonly string[];
  optedOutUserIds: readonly string[];
}

export interface NearestChunk {
  kind: string;
  targetId: string;
  chunkIndex: number;
  text: string;
  location: RetrievalLocation;
  similarity: number;
}

/**
 * Cosine distance to the query, written so the partial HNSW index for the size is used: each
 * indexed size is its own literal cast. Any other size compares untyped, by sequential scan.
 */
function distance(sql: SqlClient, size: number, vector: string) {
  switch (size) {
    case 384:
      return sql`e.embedding::vector(384) <=> ${vector}::vector(384)`;
    case 512:
      return sql`e.embedding::vector(512) <=> ${vector}::vector(512)`;
    case 768:
      return sql`e.embedding::vector(768) <=> ${vector}::vector(768)`;
    case 1024:
      return sql`e.embedding::vector(1024) <=> ${vector}::vector(1024)`;
    case 1536:
      return sql`e.embedding::vector(1536) <=> ${vector}::vector(1536)`;
    default:
      return sql`e.embedding <=> ${vector}::vector`;
  }
}

/** The closest chunks of one kind in containers the person may read, by cosine similarity. */
export async function nearest(sql: SqlClient, query: NearestQuery): Promise<NearestChunk[]> {
  const size = query.vector.length;
  if (!Number.isInteger(size) || size < 1 || size > 16_000) return [];
  const vector = toVector(query.vector);
  const away = distance(sql, size, vector);
  const column = query.container === 'space' ? sql`e.space_id` : sql`e.project_id`;
  const rows = await sql<
    {
      target_id: string;
      chunk_index: number;
      text: string;
      location: RetrievalLocation | null;
      similarity: number;
    }[]
  >`
    select e.target_id, e.chunk_index, e.text, e.location,
      1 - (${away}) as similarity
    from embeddings e
    where e.target_kind = ${query.kind} and e.model = ${query.modelId} and e.dimensions = ${size}
      and (${query.containerIds === null} or ${column} = any(${(query.containerIds ?? []) as string[]}::uuid[]))
      and (${column} is null or not ${column} = any(${query.excludedContainerIds as string[]}::uuid[]))
      and (e.author_id is null or not e.author_id = any(${query.optedOutUserIds as string[]}::uuid[]))
    order by ${away}
    limit ${query.limit}`;
  return rows.map((row) => ({
    kind: query.kind,
    targetId: row.target_id,
    chunkIndex: row.chunk_index,
    text: row.text,
    location: row.location ?? { label: 'Body' },
    similarity: Number(row.similarity),
  }));
}

/** Every stored chunk of these records, for a record keyword search found but vectors did not. */
export async function chunksOf(
  sql: SqlClient,
  query: Omit<NearestQuery, 'vector' | 'limit' | 'containerIds'> & { targetIds: readonly string[] },
): Promise<Omit<NearestChunk, 'similarity'>[]> {
  if (query.targetIds.length === 0) return [];
  const column = query.container === 'space' ? sql`space_id` : sql`project_id`;
  const rows = await sql<
    { target_id: string; chunk_index: number; text: string; location: RetrievalLocation | null }[]
  >`
    select target_id, chunk_index, text, location from embeddings
    where target_kind = ${query.kind} and model = ${query.modelId}
      and target_id = any(${query.targetIds as string[]}::text[])
      and (${column} is null or not ${column} = any(${query.excludedContainerIds as string[]}::uuid[]))
      and (author_id is null or not author_id = any(${query.optedOutUserIds as string[]}::uuid[]))
    order by target_id, chunk_index`;
  return rows.map((row) => ({
    kind: query.kind,
    targetId: row.target_id,
    chunkIndex: row.chunk_index,
    text: row.text,
    location: row.location ?? { label: 'Body' },
  }));
}
