import type { AiModelRef, AiPolicy } from '../../../contracts/ai.ts';
import type { RetrievalDocument } from '../../../contracts/retrieval.ts';
import { isAiRefusal } from '../refusals.ts';
import { boundedChunks, contentHash, embeddingInput } from './chunks.ts';
import {
  currentEmbeddingModel,
  sourceOf,
  type RetrievalDependencies,
  type Source,
} from './deps.ts';
import {
  deleteTargets,
  existingVectors,
  replaceTarget,
  toVector,
  type StoredChunk,
} from './store.ts';

/** Values per embed call: providers cap batch sizes, and a smaller batch retries cheaply. */
export const EMBED_BATCH = 64;

export type IndexOutcome =
  | { status: 'indexed'; indexed: number; removed: number; embedded: number }
  | { status: 'skipped'; reason: 'ai_off' | 'no_embedding_role' | 'refused' | 'no_source' };

/** Why a policy keeps everything out of the index, or null when indexing may go on. */
export function indexBlocked(policy: AiPolicy): 'ai_off' | 'no_embedding_role' | null {
  if (!policy.enabled) return 'ai_off';
  if (!policy.availableRoles.includes('embedding')) return 'no_embedding_role';
  return null;
}

interface Planned {
  document: RetrievalDocument;
  chunks: (Omit<StoredChunk, 'vector'> & { input: string; vector: string | null })[];
}

/** The chunks of a record that may be embedded under the policy, or null when none may. */
function plan(source: Source, document: RetrievalDocument, policy: AiPolicy): Planned | null {
  const excluded =
    source.container === 'space' ? policy.excludedSpaceIds : policy.excludedProjectIds;
  if (excluded.includes(document.containerId)) return null;
  const optedOut = new Set(policy.optedOutUserIds);
  const chunks = boundedChunks(document.chunks)
    .filter((chunk) => chunk.authorId === null || !optedOut.has(chunk.authorId))
    .map((chunk, chunkIndex) => {
      const input = embeddingInput(document, chunk);
      return {
        chunkIndex,
        text: chunk.text,
        location: chunk.location,
        authorId: chunk.authorId,
        contentHash: contentHash(`${input}\n${JSON.stringify(chunk.location)}`),
        input,
        vector: null as string | null,
      };
    });
  return chunks.length > 0 ? { document, chunks } : null;
}

/** Fills missing vectors in batches; returns the model that embedded them and how many. */
async function embedMissing(
  deps: RetrievalDependencies,
  planned: readonly Planned[],
  model: AiModelRef,
): Promise<{ model: AiModelRef; dimensions: number | null; embedded: number }> {
  const missing = planned.flatMap((entry) => entry.chunks.filter((chunk) => !chunk.vector));
  let used = model;
  let dimensions: number | null = null;
  for (let start = 0; start < missing.length; start += EMBED_BATCH) {
    const batch = missing.slice(start, start + EMBED_BATCH);
    const result = await deps.ai().embed({ purpose: 'embed', values: batch.map((c) => c.input) });
    used = result.model;
    dimensions = result.dimensions;
    batch.forEach((chunk, index) => {
      chunk.vector = toVector(result.embeddings[index]!);
    });
  }
  return { model: used, dimensions, embedded: missing.length };
}

const dimensionsOf = (vector: string): number => vector.split(',').length;

/**
 * Brings the index in line with these records: embeds what changed, keeps unchanged vectors,
 * and drops records that are gone, excluded, written only by people who opted out, or every
 * record while content sharing is off. Idempotent: a second run with nothing changed embeds
 * nothing and writes the same rows.
 */
export async function indexRecords(
  deps: RetrievalDependencies,
  kind: string,
  ids: readonly string[],
): Promise<IndexOutcome> {
  const source = sourceOf(deps, kind);
  if (!source) return { status: 'skipped', reason: 'no_source' };
  const policy = await deps.ai().policy(null);
  const blocked = indexBlocked(policy);
  if (blocked) return { status: 'skipped', reason: blocked };
  const unique = [...new Set(ids)];
  if (!policy.shareContent) {
    await deleteTargets(deps.sql, kind, unique);
    return { status: 'indexed', indexed: 0, removed: unique.length, embedded: 0 };
  }
  const model = await currentEmbeddingModel(deps);
  if (!model) return { status: 'skipped', reason: 'no_embedding_role' };

  const documents = await source.load(unique);
  const planned: Planned[] = [];
  const drop = new Set(unique);
  for (const document of documents) {
    const entry = plan(source, document, policy);
    if (!entry) continue;
    drop.delete(document.id);
    const stored = await existingVectors(deps.sql, kind, document.id, model.modelId);
    for (const chunk of entry.chunks) chunk.vector = stored.get(chunk.contentHash) ?? null;
    planned.push(entry);
  }

  let embedding: Awaited<ReturnType<typeof embedMissing>>;
  try {
    embedding = await embedMissing(deps, planned, model);
  } catch (error) {
    if (isAiRefusal(error)) return { status: 'skipped', reason: 'refused' };
    throw error;
  }
  if (embedding.embedded > 0 && embedding.model.modelId !== model.modelId) {
    // The role moved mid-run: reused vectors belong to the old model. The retry starts clean.
    throw new Error('The embedding model changed while indexing; the job will run again');
  }
  for (const entry of planned) {
    const first = entry.chunks[0]!.vector!;
    await replaceTarget(
      deps.sql,
      {
        kind,
        moduleId: source.moduleId,
        targetId: entry.document.id,
        container: source.container,
        containerId: entry.document.containerId,
      },
      {
        providerId: embedding.model.providerId,
        modelId: embedding.model.modelId,
        dimensions: embedding.dimensions ?? dimensionsOf(first),
      },
      entry.chunks.map((chunk) => ({ ...chunk, vector: chunk.vector! })),
    );
  }
  const removed = await deleteTargets(deps.sql, kind, [...drop]);
  return { status: 'indexed', indexed: planned.length, removed, embedded: embedding.embedded };
}
