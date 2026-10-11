import { currentEmbeddingModel, liveSources, type RetrievalDependencies } from './deps.ts';
import { indexBlocked, indexRecords } from './indexer.ts';
import { deleteAll, sweepExcluded } from './store.ts';

/** Records per backfill step; each step is one job so a long backfill survives restarts. */
export const BACKFILL_PAGE = 50;

export type ReconcileOutcome =
  | { status: 'skipped'; reason: 'ai_off' | 'no_embedding_role' }
  | { status: 'cleared'; removed: number }
  | { status: 'swept'; removed: number; modelId: string; backfill: boolean };

/**
 * Applies the privacy settings to what is already stored: everything goes when content
 * sharing is off; chunks in excluded spaces and projects, by people who opted out, or from
 * another embedding model go always. Says whether a backfill should follow (a model switch
 * left the index empty for the new model).
 */
export async function reconcileIndex(deps: RetrievalDependencies): Promise<ReconcileOutcome> {
  const policy = await deps.ai().policy(null);
  const blocked = indexBlocked(policy);
  if (blocked) return { status: 'skipped', reason: blocked };
  if (!policy.shareContent) return { status: 'cleared', removed: await deleteAll(deps.sql) };
  const model = await currentEmbeddingModel(deps);
  if (!model) return { status: 'skipped', reason: 'no_embedding_role' };
  const removed = await sweepExcluded(deps.sql, {
    excludedSpaceIds: policy.excludedSpaceIds,
    excludedProjectIds: policy.excludedProjectIds,
    optedOutUserIds: policy.optedOutUserIds,
    currentModelId: model.modelId,
  });
  const [row] = await deps.sql<{ indexed: boolean }[]>`
    select exists(select 1 from embeddings where model = ${model.modelId}) as indexed`;
  return { status: 'swept', removed, modelId: model.modelId, backfill: !row?.indexed };
}

export interface BackfillCursor {
  /** Index into the live sources, in registration order. */
  source: number;
  after: string | null;
}

export type BackfillStep =
  | { status: 'done' }
  | { status: 'paused'; reason: 'budget' | 'ai_off' | 'no_embedding_role' }
  | { status: 'continue'; next: BackfillCursor; indexed: number };

/**
 * One page of a full backfill. Unchanged chunks keep their vectors, so a backfill over an
 * index that is already current reads and compares but embeds nothing. While the budget is
 * spent, the backfill waits rather than adding to the bill; edits are still indexed.
 */
export async function backfillStep(
  deps: RetrievalDependencies,
  cursor: BackfillCursor,
): Promise<BackfillStep> {
  const policy = await deps.ai().policy(null);
  const blocked = indexBlocked(policy);
  if (blocked) return { status: 'paused', reason: blocked };
  if (policy.budgetState === 'paused') return { status: 'paused', reason: 'budget' };
  const sources = liveSources(deps);
  const source = sources[cursor.source];
  if (!source) return { status: 'done' };
  const ids = await source.list({ after: cursor.after, limit: BACKFILL_PAGE });
  if (ids.length === 0) {
    return cursor.source + 1 < sources.length
      ? { status: 'continue', next: { source: cursor.source + 1, after: null }, indexed: 0 }
      : { status: 'done' };
  }
  const outcome = await indexRecords(deps, source.kind, ids);
  if (outcome.status === 'skipped' && outcome.reason !== 'no_source') {
    return {
      status: 'paused',
      reason: outcome.reason === 'ai_off' ? 'ai_off' : 'no_embedding_role',
    };
  }
  return {
    status: 'continue',
    next: { source: cursor.source, after: ids.at(-1)! },
    indexed: outcome.status === 'indexed' ? outcome.indexed : 0,
  };
}
