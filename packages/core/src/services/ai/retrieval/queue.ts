import type { RetrievalDependencies } from './deps.ts';

export const RETRIEVAL_JOBS = {
  index: 'ai.retrieval.index',
  reconcile: 'ai.retrieval.reconcile',
  backfill: 'ai.retrieval.backfill',
} as const;

/** Edits settle before they are embedded; a burst of changes is one drain. */
export const INDEX_DELAY_SECONDS = 10;

/**
 * Queues the drain of a source's pending records. The key is the source alone, so however many
 * records change, a source has at most one drain waiting (and one running).
 */
export async function queueDrain(
  deps: RetrievalDependencies,
  kind: string,
  delaySeconds: number,
): Promise<void> {
  await deps.jobs?.enqueue(
    RETRIEVAL_JOBS.index,
    { kind },
    { key: `drain:${kind}`, singleton: true, startAfter: delaySeconds },
  );
}
