import type { Http } from '@bemmoly/api-client';
import {
  applicationPipelineSchema,
  canaryAnalysisSchema,
  environmentStripSchema,
  forYouSchema,
  logRangeSchema,
  logSearchSchema,
  mapSchema,
  runDetailSchema,
  runGraphSchema,
  runSummarySchema,
  runsPageSchema,
  savedViewSchema,
  savedViewsResponseSchema,
  type CreateSavedViewBody,
  type SavedViewScreen,
  type CancelRunBody,
  type CreateRunBody,
  type ListRunsQuery,
  type LogRangeQuery,
  type MapQuery,
  type RerunBody,
} from '@bemmoly/module-pipelines/shared';
import { toQuery } from './query.ts';

const base = '/api/v1/pipelines';
const segment = encodeURIComponent;

/** Query keys under the Pipelines root, so the application's events reach its strip too. */
export const deliveryKeys = {
  forYou: (tab: string) => ['pipelines', 'for-you', tab] as const,
  map: (query: MapQuery) => ['pipelines', 'map', query] as const,
  strip: (key: string) => ['pipelines', 'application', key, 'environments'] as const,
  canary: (deploymentId: string) => ['pipelines', 'canary', deploymentId] as const,
  pipeline: (key: string) => ['pipelines', 'application', key, 'pipeline'] as const,
  runs: (query: Partial<ListRunsQuery>) => ['pipelines', 'runs', query] as const,
  run: (id: string) => ['pipelines', 'run', id] as const,
  runGraph: (id: string) => ['pipelines', 'run', id, 'graph'] as const,
  logSearch: (jobId: string, q: string) => ['pipelines', 'log', jobId, 'search', q] as const,
  views: (screen: string) => ['pipelines', 'views', screen] as const,
};

/**
 * /api/v1/pipelines: what moves through the catalog. For you, the map, an application's
 * environments, runs, jobs' logs and deployments, each read through its shared contract.
 */
export function deliveryEndpoints(http: Http) {
  return {
    forYou: (tab: 'in-flight' | 'shipped') =>
      http.request(`${base}/for-you`, forYouSchema, { query: { tab } }),
    map: (query: MapQuery) => http.request(`${base}/map`, mapSchema, { query: toQuery(query) }),
    environmentStrip: (key: string) =>
      http.request(`${base}/applications/${segment(key)}/environments`, environmentStripSchema),
    canary: (deploymentId: string) =>
      http.request(`${base}/deployments/${segment(deploymentId)}/canary`, canaryAnalysisSchema),
    applicationPipeline: (key: string) =>
      http.request(`${base}/applications/${segment(key)}/pipeline`, applicationPipelineSchema),
    runs: (query: Partial<ListRunsQuery>) =>
      http.request(`${base}/runs`, runsPageSchema, { query: toQuery(query) }),
    run: (id: string) => http.request(`${base}/runs/${segment(id)}`, runDetailSchema),
    runGraph: (id: string) => http.request(`${base}/runs/${segment(id)}/graph`, runGraphSchema),
    createRun: (body: CreateRunBody) =>
      http.request(`${base}/runs`, runSummarySchema, { method: 'POST', body, idempotent: true }),
    rerun: (id: string, body: RerunBody) =>
      http.request(`${base}/runs/${segment(id)}/rerun`, runSummarySchema, {
        method: 'POST',
        body,
        idempotent: true,
      }),
    cancelRun: (id: string, body: CancelRunBody) =>
      http.send(`${base}/runs/${segment(id)}/cancel`, { method: 'POST', body }),
    log: (jobId: string, query: LogRangeQuery) =>
      http.request(`${base}/jobs/${segment(jobId)}/logs`, logRangeSchema, {
        query: toQuery(query),
      }),
    views: (screen: SavedViewScreen) =>
      http.request(`${base}/views`, savedViewsResponseSchema, { query: { screen } }),
    createView: (body: CreateSavedViewBody) =>
      http.request(`${base}/views`, savedViewSchema, { method: 'POST', body, idempotent: true }),
    deleteView: (id: string) => http.send(`${base}/views/${segment(id)}`, { method: 'DELETE' }),
    searchLog: (jobId: string, q: string) =>
      http.request(`${base}/jobs/${segment(jobId)}/logs/search`, logSearchSchema, {
        query: { q, limit: 500 },
      }),
  };
}
