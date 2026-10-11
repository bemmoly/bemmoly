import type { AiPolicy } from '../../../contracts/ai.ts';
import type { DomainEvent } from '../../../contracts/event-bus.ts';
import type { RealtimeMessage } from '../../../contracts/realtime.ts';
import { liveSources, type RetrievalDependencies, type Source } from './deps.ts';
import { indexBlocked, indexRecords } from './indexer.ts';
import { hasPending, markPending, peekPending, pendingKinds, settlePending } from './pending.ts';
import { INDEX_DELAY_SECONDS, queueDrain, RETRIEVAL_JOBS } from './queue.ts';
import { deleteTargets } from './store.ts';

/** Records one drain job indexes; a longer backlog continues in the next job. */
export const DRAIN_PAGE = 100;

const blockedReasons: ReadonlySet<string> = new Set(['ai_off', 'no_embedding_role']);

/**
 * Why changes are not followed now, or null when they are. While AI is off, no embedding role
 * is set or content sharing is off, nothing is marked or queued: the settings change that lifts
 * the block starts a backfill, which picks up everything that changed meanwhile.
 */
export function followBlocked(policy: AiPolicy): 'ai_off' | 'no_embedding_role' | 'off' | null {
  return indexBlocked(policy) ?? (policy.shareContent ? null : 'off');
}

function excludedContainer(source: Source, message: RealtimeMessage, policy: AiPolicy): boolean {
  const containerId = source.container === 'space' ? message.spaceId : message.projectId;
  if (!containerId) return false;
  const excluded =
    source.container === 'space' ? policy.excludedSpaceIds : policy.excludedProjectIds;
  return excluded.includes(containerId);
}

/**
 * Follows the modules' realtime invalidations: a source's change kind names records whose
 * content, place or trash state moved. The check reads only the cached policy, so a burst
 * while retrieval cannot run costs nothing. Otherwise the records are marked pending and the
 * source's drain is queued (one waiting per source, whatever the burst). Every replica hears
 * the message; marking and the singleton key make that harmless. Records in an excluded
 * container are not indexed; any chunks they brought from where they were are dropped.
 */
export async function followRealtime(
  deps: RetrievalDependencies,
  message: RealtimeMessage,
): Promise<void> {
  if (!deps.jobs || message.ids.length === 0) return;
  const sources = liveSources(deps).filter((source) => source.changeKinds.includes(message.kind));
  if (sources.length === 0) return;
  const policy = await deps.ai().policy(null);
  if (followBlocked(policy)) return;
  for (const source of sources) {
    if (excludedContainer(source, message, policy)) {
      await deleteTargets(deps.sql, source.kind, [...new Set(message.ids)]);
      continue;
    }
    await markPending(deps.sql, source.kind, message.ids);
    await queueDrain(deps, source.kind, INDEX_DELAY_SECONDS);
  }
}

/**
 * Indexes the oldest pending records of a source and clears what it indexed; queues itself
 * again while more wait. A block that appeared since the records were marked keeps them: the
 * reconcile that follows the settings change lifting it restarts the drain.
 */
export async function drainPending(deps: RetrievalDependencies, kind: string): Promise<void> {
  const marks = await peekPending(deps.sql, kind, DRAIN_PAGE);
  if (marks.length === 0) return;
  const outcome = await indexRecords(
    deps,
    kind,
    marks.map((mark) => mark.targetId),
  );
  if (outcome.status === 'skipped' && blockedReasons.has(outcome.reason)) return;
  await settlePending(deps.sql, kind, marks);
  if (await hasPending(deps.sql, kind)) await queueDrain(deps, kind, 0);
}

/** The safety net: restarts the drain of every source with records waiting. */
export async function restartDrains(deps: RetrievalDependencies): Promise<void> {
  for (const kind of await pendingKinds(deps.sql)) await queueDrain(deps, kind, 0);
}

/**
 * AI turned on, privacy or an opt-out changed, or the embedding role moved: drop what may no
 * longer be stored and run a backfill, which embeds only what is missing.
 */
export async function followSettings(
  deps: RetrievalDependencies,
  event: DomainEvent,
): Promise<void> {
  await deps.jobs?.enqueue(
    RETRIEVAL_JOBS.reconcile,
    { backfill: true },
    { key: `settings:${event.occurredAt.toISOString()}` },
  );
}
