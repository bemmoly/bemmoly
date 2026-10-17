import {
  reportStatsQuerySchema,
  reportStatsSchema,
  type ReportStatsQuery,
} from '../../../shared/index.ts';
import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';

const BASE = '/api/v1/work';

/** Field statistics: the project's issues counted by one field, or two crossed. */
export function workReportStatsEndpoints(http: Http) {
  return {
    reportStats: {
      get: async (
        projectKey: string,
        query: ReportStatsQuery = {},
        options: { signal?: AbortSignal } = {},
      ) =>
        http.request(`${BASE}/projects/${enc(projectKey)}/reports/stats`, reportStatsSchema, {
          query: validated(reportStatsQuerySchema, query),
          ...options,
        }),
    },
  };
}
