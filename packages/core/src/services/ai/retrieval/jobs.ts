import { z } from 'zod';
import type { RetrievalDependencies } from './deps.ts';
import { drainPending, followBlocked, restartDrains } from './follow.ts';
import { indexRecords } from './indexer.ts';
import { RETRIEVAL_JOBS } from './queue.ts';
import { backfillStep, reconcileIndex, type BackfillCursor } from './reconcile.ts';

export { RETRIEVAL_JOBS } from './queue.ts';

/** The safety net: settings changes also start a reconcile at once. */
export const RECONCILE_SCHEDULE = '*/15 * * * *';
/** A spent budget pauses the backfill; it looks again after this. */
export const BUDGET_RETRY_SECONDS = 3_600;

/** A drain names its source; jobs queued by older versions also carry their record ids. */
const indexPayload = z.object({
  kind: z.string(),
  ids: z.array(z.string()).min(1).max(500).optional(),
});
const reconcilePayload = z.object({ backfill: z.boolean().optional() }).loose();
const backfillPayload = z.object({
  run: z.string(),
  source: z.number().int().nonnegative(),
  after: z.string().nullable(),
});

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
        // Checked first so a backlog queued while retrieval could not run drains for free.
        if (followBlocked(await deps.ai().policy(null))) return;
        if (ids) await indexRecords(deps, kind, ids);
        else await drainPending(deps, kind);
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
        await restartDrains(deps);
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
