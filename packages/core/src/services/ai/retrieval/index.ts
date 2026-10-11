import type { AiAnswerRequest } from '@bemmoly/shared/ai-answers';
import type { DomainEvent } from '../../../contracts/event-bus.ts';
import type { RealtimeMessage } from '../../../contracts/realtime.ts';
import type { RequestContext } from '../../authz/index.ts';
import { answerQuestion } from './answer.ts';
import type { RetrievalDependencies } from './deps.ts';
import { indexRecords } from './indexer.ts';
import { followRealtime, followSettings, retrievalJobs } from './jobs.ts';
import { backfillStep, reconcileIndex, type BackfillCursor } from './reconcile.ts';
import { retrieve, type RetrieveInput } from './retrieve.ts';

export type { RetrievalDependencies } from './deps.ts';
export type { IndexOutcome } from './indexer.ts';
export { RETRIEVAL_JOBS, type RetrievalJob } from './jobs.ts';
export type { BackfillCursor, BackfillStep, ReconcileOutcome } from './reconcile.ts';
export type { RetrievalContext, RetrievedChunk } from './retrieve.ts';
export { ANSWER_PROMPT_FILE, ANSWER_PROMPT_ID, answerVariables, NO_ANSWER } from './prompt.ts';
export { fuseRankings } from './rrf.ts';
export { splitText } from './chunks.ts';

/**
 * Embeddings, retrieval and "Ask your docs" (tech design §11.3, §11.6, §16): the index follows
 * the modules' sources through jobs, retrieval answers only with what the asker may open, and
 * answers stream with citations.
 */
export function createRetrievalService(deps: RetrievalDependencies) {
  return {
    answer: (ctx: RequestContext, request: AiAnswerRequest, signal?: AbortSignal) =>
      answerQuestion(deps, ctx, request, signal),
    retrieve: (ctx: RequestContext, input: RetrieveInput) => retrieve(deps, ctx, input),
    indexRecords: (kind: string, ids: readonly string[]) => indexRecords(deps, kind, ids),
    reconcile: () => reconcileIndex(deps),
    backfillStep: (cursor: BackfillCursor) => backfillStep(deps, cursor),
    jobs: () => retrievalJobs(deps),
    /** Wire to the realtime listener: modules' invalidations become index jobs. */
    handleRealtime: (message: RealtimeMessage) => followRealtime(deps, message),
    /** Wire to `ai.settings.changed` on the kernel event bus. */
    handleSettingsChanged: (event: DomainEvent) => followSettings(deps, event),
  };
}

export type RetrievalService = ReturnType<typeof createRetrievalService>;
