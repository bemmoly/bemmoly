import {
  controlChartSchema,
  cycleReportQuerySchema,
  scopeReportQuerySchema,
  scopeReportSchema,
  timeInStatusSchema,
  type CycleReportQuery,
  type ScopeReportQuery,
  flowReportQuerySchema,
  flowReportSchema,
  sprintReportSchema,
  type FlowReportQuery,
} from '../../../shared/index.ts';
import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';

const BASE = '/api/v1/work';

/** The Reports screen's reads: a sprint's report, the project's flow and cycle series, a scope. */
export function workReportEndpoints(http: Http) {
  return {
    reports: {
      sprint: async (sprintId: string, options: { signal?: AbortSignal } = {}) =>
        http.request(`${BASE}/sprints/${enc(sprintId)}/report`, sprintReportSchema, options),
      flow: async (
        projectKey: string,
        query: FlowReportQuery = {},
        options: { signal?: AbortSignal } = {},
      ) =>
        http.request(`${BASE}/projects/${enc(projectKey)}/reports/flow`, flowReportSchema, {
          query: validated(flowReportQuerySchema, query),
          ...options,
        }),
      control: async (
        projectKey: string,
        query: CycleReportQuery = {},
        options: { signal?: AbortSignal } = {},
      ) =>
        http.request(`${BASE}/projects/${enc(projectKey)}/reports/control`, controlChartSchema, {
          query: validated(cycleReportQuerySchema, query),
          ...options,
        }),
      timeInStatus: async (
        projectKey: string,
        query: CycleReportQuery = {},
        options: { signal?: AbortSignal } = {},
      ) =>
        http.request(
          `${BASE}/projects/${enc(projectKey)}/reports/time-in-status`,
          timeInStatusSchema,
          { query: validated(cycleReportQuerySchema, query), ...options },
        ),
      /** An epic's or version's weekly burnup, with the epics or versions to choose from. */
      scope: async (
        projectKey: string,
        query: ScopeReportQuery = {},
        options: { signal?: AbortSignal } = {},
      ) =>
        http.request(`${BASE}/projects/${enc(projectKey)}/reports/scope`, scopeReportSchema, {
          query: validated(scopeReportQuerySchema, query),
          ...options,
        }),
    },
  };
}
