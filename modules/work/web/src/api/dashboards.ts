import {
  addDashboardWidgetBodySchema,
  createDashboardBodySchema,
  dashboardSchema,
  dashboardsResponseSchema,
  quarterReportQuerySchema,
  quarterReportSchema,
  updateDashboardBodySchema,
  type AddDashboardWidgetBody,
  type CreateDashboardBody,
  type QuarterReportQuery,
  type UpdateDashboardBody,
} from '../../../shared/index.ts';
import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';

const BASE = '/api/v1/work';
const DASHBOARDS = `${BASE}/dashboards`;

/** /api/v1/work/dashboards: one person's report grids, and the quarter view they can hold. */
export function workDashboardEndpoints(http: Http) {
  return {
    dashboards: {
      list: async (projectKey: string, options: { signal?: AbortSignal } = {}) =>
        (
          await http.request(DASHBOARDS, dashboardsResponseSchema, {
            query: { projectId: projectKey },
            ...options,
          })
        ).items,
      create: async (body: CreateDashboardBody) =>
        http.request(DASHBOARDS, dashboardSchema, {
          method: 'POST',
          body: validated(createDashboardBodySchema, body),
        }),
      update: async (id: string, body: UpdateDashboardBody) =>
        http.request(`${DASHBOARDS}/${enc(id)}`, dashboardSchema, {
          method: 'PATCH',
          body: validated(updateDashboardBodySchema, body),
        }),
      remove: async (id: string) => http.send(`${DASHBOARDS}/${enc(id)}`, { method: 'DELETE' }),
      /** Adds one widget; how a report saved elsewhere is pinned. */
      addWidget: async (id: string, body: AddDashboardWidgetBody) =>
        http.request(`${DASHBOARDS}/${enc(id)}/widgets`, dashboardSchema, {
          method: 'POST',
          body: validated(addDashboardWidgetBodySchema, body),
        }),
    },
    quarter: async (
      projectKey: string,
      query: QuarterReportQuery = {},
      options: { signal?: AbortSignal } = {},
    ) =>
      http.request(`${BASE}/projects/${enc(projectKey)}/reports/quarter`, quarterReportSchema, {
        query: validated(quarterReportQuerySchema, query),
        ...options,
      }),
  };
}
