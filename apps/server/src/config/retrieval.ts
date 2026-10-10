import {
  AI_SETTINGS_CHANGED,
  createRetrievalService,
  type AiFacade,
  type ClusterEventBus,
  type JobQueue,
  type ModuleRegistry,
  type ModuleState,
  type RealtimeListener,
  type RetrievalService,
  type SqlClient,
} from '@bemmoly/core';
import type { Logger } from '@bemmoly/core/config';

export interface RetrievalWiringInput {
  sql: SqlClient;
  modules: ModuleRegistry;
  moduleState: ModuleState;
  jobs: JobQueue;
  listener: RealtimeListener;
  events: ClusterEventBus;
  /** The bound AI runtime, read on every call. */
  ai: () => AiFacade;
  logger: Logger;
}

/**
 * Embeddings and "Ask your docs": the index jobs join the queue, the modules' realtime
 * invalidations become index jobs, an AI settings change starts a reconcile, and the service
 * goes to the kernel routes for POST /api/v1/ai/answers.
 */
export function wireRetrieval(input: RetrievalWiringInput): RetrievalService {
  const logger = input.logger.child({ component: 'retrieval' });
  const retrieval = createRetrievalService({
    sql: input.sql,
    ai: input.ai,
    sources: () => input.modules.retrievalSources(),
    keyword: () => input.modules.searchProviders(),
    isEnabled: (id) => input.moduleState.isEnabled(id),
    jobs: input.jobs,
    logger,
  });
  for (const job of retrieval.jobs()) {
    input.jobs.register(job.name, (payload) => job.handle(payload), {
      ...(job.schedule ? { schedule: job.schedule } : {}),
      ...(job.retryLimit !== undefined ? { retryLimit: job.retryLimit } : {}),
    });
  }
  const report = (error: unknown) =>
    logger.warn({ err: error }, 'Could not queue a retrieval index job');
  input.listener.onMessage((message) => {
    retrieval.handleRealtime(message).catch(report);
  });
  input.events.subscribe(AI_SETTINGS_CHANGED, (event) => retrieval.handleSettingsChanged(event));
  return retrieval;
}
