import {
  askReportBodySchema,
  askReportResponseSchema,
  createPinnedReportBodySchema,
  pinnedReportListSchema,
  pinnedReportSchema,
  reportResultSchema,
  runReportBodySchema,
  type CreatePinnedReportBody,
  type ReportSpec,
} from '../../../shared/index.ts';
import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';

const BASE = '/api/v1/work';

/** Reports asked for in words, a spec run without AI, and the person's pinned reports. */
export function workAskReportEndpoints(http: Http) {
  return {
    askReports: {
      ask: async (projectKey: string, question: string, options: { signal?: AbortSignal } = {}) =>
        http.request(`${BASE}/projects/${enc(projectKey)}/reports/ask`, askReportResponseSchema, {
          method: 'POST',
          body: validated(askReportBodySchema, { question }),
          ...options,
        }),
      run: async (projectKey: string, spec: ReportSpec) =>
        http.request(`${BASE}/projects/${enc(projectKey)}/reports/run`, reportResultSchema, {
          method: 'POST',
          body: validated(runReportBodySchema, { spec }),
        }),
    },
    pinnedReports: {
      list: async (projectKey: string, options: { signal?: AbortSignal } = {}) =>
        (
          await http.request(
            `${BASE}/projects/${enc(projectKey)}/pinned-reports`,
            pinnedReportListSchema,
            options,
          )
        ).items,
      pin: async (projectKey: string, body: CreatePinnedReportBody) =>
        http.request(`${BASE}/projects/${enc(projectKey)}/pinned-reports`, pinnedReportSchema, {
          method: 'POST',
          body: validated(createPinnedReportBodySchema, body),
        }),
      unpin: async (id: string) =>
        http.send(`${BASE}/pinned-reports/${enc(id)}`, { method: 'DELETE' }),
    },
  };
}
