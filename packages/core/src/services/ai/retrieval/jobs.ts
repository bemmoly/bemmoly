import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { DomainEvent } from '../../../contracts/event-bus.ts';
import type { RealtimeMessage } from '../../../contracts/realtime.ts';
import { liveSources, type RetrievalDependencies } from './deps.ts';
import { indexRecords } from './indexer.ts';
import { backfillStep, reconcileIndex, type BackfillCursor } from './reconcile.ts';

export const RETRIEVAL_JOBS = {
  index: 'ai.retrieval.index',
  reconcile: 'ai.retrieval.reconcile',
  backfill: 'ai.retrieval.backfill',
} as const;

/** Edits settle before they are embedded; a burst of typing is one job. */
export const INDEX_DELAY_SECONDS = 10;
/** The safety net: settings changes also start a reconcile at once. */
export const RECONCILE_SCHEDULE = '*/15 * * * *';
/** A spent budget pauses the backfill; it looks again after this. */
export const BUDGET_RETRY_SECONDS = 3_600;

const indexPayload = z.object({ kind: z.string(), ids: z.array(z.string()).min(1).max(500) });
const reconcilePayload = z.object({ backfill: z.boolean().optional() }).loose();
const backfillPayload = z.object({
  run: z.string(),
  source: z.number().int().nonnegative(),
  after: z.string().nullable(),
});

const digest = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 24);

export interface RetrievalJob {
  name: string;
  handle(payload: unknown): Promise<void>;
  schedule?: string;
  retryLimit?: number;
}

/** Queues a backfill run from the first source; one run per key. */
async function startBackfill(deps: RetrievalDependencies, run: string): Promise<void> {
  await deps.jobs?.enqueue(
    RETRIEVAL_JOBS.backfill,
    { run, source: 0, after: null },
    { key: `${run}:0:start` },
  );
}

export function retrievalJobs(deps: RetrievalDependencies): RetrievalJob[] {
  return [
    {
      name: RETRIEVAL_JOBS.index,
      retryLimit: 5,
      async handle(payload) {
        const { kind, ids } = indexPayload.parse(payload);
        await indexRecords(deps, kind, ids);
      },
    },
    {
      name: RETRIEVAL_JOBS.reconcile,
      schedule: RECONCILE_SCHEDULE,
      retryLimit: 2,
      async handle(payload) {
        const { backfill } = reconcilePayload.parse(payload ?? {});
        const outcome = await reconcileIndex(deps);
        if (outcome.status !== 'swept') return;
        if (backfill || outcome.backfill) {
          await startBackfill(deps, `${outcome.modelId}:${new Date().toISOString()}`);
        }
      },
    },
    {
      name: RETRIEVAL_JOBS.backfill,
      retryLimit: 5,
      async handle(payload) {
        const { run, source, after } = backfillPayload.parse(payload);
        const cursor: BackfillCursor = { source, after };
        const step = await backfillStep(deps, cursor);
        if (step.status === 'done') {
          deps.logger?.info({ run }, 'Retrieval backfill finished');
          return;
        }
        if (step.status === 'paused') {
          if (step.reason !== 'budget') return;
          await deps.jobs?.enqueue(
            RETRIEVAL_JOBS.backfill,
            { run, source, after },
            {
              key: `${run}:${source}:${after ?? 'start'}:${Date.now()}`,
              startAfter: BUDGET_RETRY_SECONDS,
            },
          );
          return;
        }
        const next = step.next;
        await deps.jobs?.enqueue(
          RETRIEVAL_JOBS.backfill,
          { run, source: next.source, after: next.after },
          { key: `${run}:${next.source}:${next.after ?? 'start'}` },
        );
      },
    },
  ];
}

/**
 * Follows the modules' realtime invalidations: a source's change kind names records whose
 * content, place or trash state moved. Every replica hears the message; the singleton key
 * keeps one waiting job per set of records, and the delay lets an edit settle.
 */
export async function followRealtime(
  deps: RetrievalDependencies,
  message: RealtimeMessage,
): Promise<void> {
  if (!deps.jobs || message.ids.length === 0) return;
  const sources = liveSources(deps).filter((source) => source.changeKinds.includes(message.kind));
  if (sources.length === 0 || !(await deps.ai().enabled(null))) return;
  for (const source of sources) {
    for (let start = 0; start < message.ids.length; start += 500) {
      const ids = [...message.ids.slice(start, start + 500)].sort();
      await deps.jobs.enqueue(
        RETRIEVAL_JOBS.index,
        { kind: source.kind, ids },
        {
          key: `${source.kind}:${digest(ids.join(','))}`,
          singleton: true,
          startAfter: INDEX_DELAY_SECONDS,
        },
      );
    }
  }
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
