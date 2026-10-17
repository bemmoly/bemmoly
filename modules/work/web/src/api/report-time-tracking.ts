import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';
import {
  timeTrackingQuerySchema,
  timeTrackingReportSchema,
  type TimeTrackingQuery,
} from '../../../shared/index.ts';

const BASE = '/api/v1/work';

/** The time tracking report: minutes logged in a window or a sprint, by week, person and issue. */
export function workReportTimeTrackingEndpoints(http: Http) {
  return {
    reportTimeTracking: {
      get: async (
        projectKey: string,
        query: TimeTrackingQuery = {},
        options: { signal?: AbortSignal } = {},
      ) =>
        http.request(
          `${BASE}/projects/${enc(projectKey)}/reports/time-tracking`,
          timeTrackingReportSchema,
          { query: validated(timeTrackingQuerySchema, query), ...options },
        ),
    },
  };
}
