import { ForbiddenError } from '@bemmoly/shared';
import { type AiAnswerSource } from '@bemmoly/shared/ai-answers';
import type { AiPolicy } from '../../../contracts/ai.ts';
import type { RequestContext } from '../../authz/index.ts';
import {
  currentEmbeddingModel,
  liveSources,
  type RetrievalDependencies,
  type Source,
} from './deps.ts';
import { fuseRankings } from './rrf.ts';
import { chunksOf, nearest, type NearestChunk } from './store.ts';

/** Records the answer may draw on, and chunks in all; enough to answer, small enough to read. */
export const MAX_RECORDS = 6;
export const MAX_CHUNKS = 12;
const CHUNKS_PER_RECORD = 3;
const VECTOR_CANDIDATES = 30;
const KEYWORD_CANDIDATES = 10;
/** Below this cosine similarity a chunk is noise, whatever the model. */
export const MIN_SIMILARITY = 0.2;

/** One cited chunk: `[c3]` in the prompt and in the answer. */
export interface RetrievedChunk {
  source: AiAnswerSource;
  text: string;
}

/** retrievalContext: what the person may read that best answers the question, with citations. */
export interface RetrievalContext {
  chunks: RetrievedChunk[];
  sources: AiAnswerSource[];
}

export interface RetrieveInput {
  question: string;
  kinds?: readonly string[];
}

type Candidate = Omit<NearestChunk, 'similarity'> & { similarity?: number };

const keyOf = (kind: string, id: string) => `${kind}\u0000${id}`;

function terms(question: string): string[] {
  return question
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)
    .filter((term) => term.length > 2);
}

/** For a record found only by keywords: its chunks that share the most words with the question. */
function byOverlap(chunks: readonly Candidate[], question: string): Candidate[] {
  const wanted = terms(question);
  const score = (chunk: Candidate) => {
    const lower = `${chunk.location.label} ${chunk.text}`.toLowerCase();
    return wanted.filter((term) => lower.includes(term)).length;
  };
  return [...chunks].sort((a, b) => score(b) - score(a) || a.chunkIndex - b.chunkIndex);
}

async function keywordIds(
  deps: RetrievalDependencies,
  ctx: RequestContext,
  source: Source,
  q: string,
) {
  const provider = deps.keyword().find((entry) => entry.kind === source.kind);
  if (!provider) return [];
  try {
    const found = await provider.search(ctx, { q: q.slice(0, 200), limit: KEYWORD_CANDIDATES });
    return found.map((result) => result.id);
  } catch (error) {
    if (error instanceof ForbiddenError) return [];
    throw error;
  }
}

const excludedFor = (source: Source, policy: AiPolicy) =>
  source.container === 'space' ? policy.excludedSpaceIds : policy.excludedProjectIds;

/**
 * Top chunks by vector similarity in the containers the person may read, fused with the
 * keyword search's records by reciprocal rank fusion, checked once more record by record with
 * the module's own access rule, and numbered as citations. Excluded containers and opted-out
 * authors never come back, even if a stale row is still stored.
 */
export async function retrieve(
  deps: RetrievalDependencies,
  ctx: RequestContext,
  input: RetrieveInput,
): Promise<RetrievalContext> {
  const ai = deps.ai();
  const reachable = await ctx.authz.modulesFor(ctx.actor);
  const sources = liveSources(deps).filter(
    (source) =>
      reachable.has(source.moduleId) && (!input.kinds || input.kinds.includes(source.kind)),
  );
  const model = await currentEmbeddingModel(deps);
  if (sources.length === 0 || !model) return { chunks: [], sources: [] };
  const policy = await ai.policy(ctx.actor);
  const [vector] = (
    await ai.embed({
      purpose: 'embed',
      actor: ctx.actor,
      values: [input.question],
      ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
    })
  ).embeddings;

  const candidates = new Map<string, Candidate[]>();
  const vectorHits: (NearestChunk & { key: string })[] = [];
  const keywordLists: string[][] = [];
  for (const source of sources) {
    const filters = {
      kind: source.kind,
      container: source.container,
      modelId: model.modelId,
      excludedContainerIds: excludedFor(source, policy),
      optedOutUserIds: policy.optedOutUserIds,
    };
    const hits = await nearest(deps.sql, {
      ...filters,
      containerIds: await source.readableContainers(ctx),
      vector: vector!,
      limit: VECTOR_CANDIDATES,
    });
    for (const hit of hits.filter((h) => h.similarity >= MIN_SIMILARITY)) {
      const key = keyOf(source.kind, hit.targetId);
      vectorHits.push({ ...hit, key });
      candidates.set(key, [...(candidates.get(key) ?? []), hit]);
    }
    const ids = await keywordIds(deps, ctx, source, input.question);
    keywordLists.push(ids.map((id) => keyOf(source.kind, id)));
    for (const chunk of await chunksOf(deps.sql, { ...filters, targetIds: ids })) {
      const key = keyOf(source.kind, chunk.targetId);
      const pool = candidates.get(key) ?? [];
      if (!pool.some((known) => known.chunkIndex === chunk.chunkIndex)) pool.push(chunk);
      candidates.set(key, pool);
    }
  }
  vectorHits.sort((a, b) => b.similarity - a.similarity);
  const fused = fuseRankings([vectorHits.map((hit) => hit.key), ...keywordLists]).filter((key) =>
    candidates.has(key),
  );
  return cite(sources, ctx, fused.slice(0, MAX_RECORDS * 2), candidates, input.question);
}

/** Checks access record by record, keeps the best chunks of the first records, numbers them. */
async function cite(
  sources: readonly Source[],
  ctx: RequestContext,
  ranked: readonly string[],
  candidates: ReadonlyMap<string, Candidate[]>,
  question: string,
): Promise<RetrievalContext> {
  const chunks: RetrievedChunk[] = [];
  const records = ranked.map((key) => {
    const [kind, id] = key.split('\u0000') as [string, string];
    return { key, kind, id };
  });
  const allowed = new Set<string>();
  const documents = new Map<string, { title: string; path: string }>();
  for (const source of sources) {
    const ids = records.filter((record) => record.kind === source.kind).map((r) => r.id);
    if (ids.length === 0) continue;
    const visible = await source.visible(ctx, ids);
    for (const document of await source.load(ids.filter((id) => visible.has(id)))) {
      allowed.add(keyOf(source.kind, document.id));
      documents.set(keyOf(source.kind, document.id), document);
    }
  }
  const kept = records.filter((record) => allowed.has(record.key)).slice(0, MAX_RECORDS);
  for (const record of kept) {
    const source = sources.find((entry) => entry.kind === record.kind)!;
    const document = documents.get(record.key)!;
    const pool = candidates.get(record.key)!;
    // Chunks the vectors matched lead; a keyword match fills the rest with its closest words.
    const best = [
      ...pool
        .filter((chunk) => chunk.similarity !== undefined)
        .sort((a, b) => b.similarity! - a.similarity!),
      ...byOverlap(
        pool.filter((chunk) => chunk.similarity === undefined),
        question,
      ),
    ];
    for (const chunk of best.slice(0, CHUNKS_PER_RECORD)) {
      if (chunks.length >= MAX_CHUNKS) break;
      const id = `c${chunks.length + 1}`;
      const anchor = chunk.location.anchor ? `#${chunk.location.anchor}` : '';
      chunks.push({
        text: chunk.text,
        source: {
          id,
          kind: record.kind,
          targetId: record.id,
          title: document.title,
          href: `${document.path}${anchor}`,
          location: chunk.location,
          noun: source.noun,
        },
      });
    }
  }
  return { chunks, sources: chunks.map((chunk) => chunk.source) };
}
