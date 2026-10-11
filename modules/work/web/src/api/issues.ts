import {
  createIssueBodySchema,
  createWorkLogBodySchema,
  issueDetailSchema,
  issueHistoryPageSchema,
  issueSchema,
  issuesPageSchema,
  issueTransitionsResponseSchema,
  listIssueHistoryQuerySchema,
  listIssuesQuerySchema,
  suggestQuerySchema,
  suggestResponseSchema,
  updateIssueBodySchema,
  watchersResponseSchema,
  watchIssueBodySchema,
  workLogSchema,
  workLogsResponseSchema,
  type CreateIssueBody,
  type CreateWorkLogBody,
  type ListIssueHistoryQuery,
  type ListIssuesQuery,
  type UpdateIssueBody,
} from '../../../shared/index.ts';
import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';

const BASE = '/api/v1/work';

export type IssuesFilter = Partial<ListIssuesQuery>;
export type HistoryFilter = Partial<ListIssueHistoryQuery>;

/**
 * The Issue page and the create form: one issue and what hangs off it by key. A status change
 * is a PATCH with the transition's target status; the workflow decides whether it is allowed.
 */
export function workIssueEndpoints(http: Http) {
  const issue = (key: string, rest = '') => `${BASE}/issues/${enc(key)}${rest}`;
  return {
    issues: {
      list: async (filter: IssuesFilter = {}) =>
        http.request(`${BASE}/issues`, issuesPageSchema, {
          query: validated(listIssuesQuerySchema, filter),
        }),
      get: async (key: string) => http.request(issue(key), issueDetailSchema),
      /** The create form posts with an idempotency key, so a retry never takes a second number. */
      create: async (body: CreateIssueBody) =>
        http.request(`${BASE}/issues`, issueSchema, {
          method: 'POST',
          body: validated(createIssueBodySchema, body),
          idempotent: true,
        }),
      update: async (key: string, body: UpdateIssueBody) =>
        http.request(issue(key), issueSchema, {
          method: 'PATCH',
          body: validated(updateIssueBodySchema, body),
        }),
      remove: async (key: string) => http.send(issue(key), { method: 'DELETE' }),
      /** Transitions out of the current status, with what blocks each one. */
      transitions: async (key: string) =>
        (await http.request(issue(key, '/transitions'), issueTransitionsResponseSchema)).items,
      watchers: async (key: string) =>
        (await http.request(issue(key, '/watchers'), watchersResponseSchema)).items,
      watch: async (key: string, watching: boolean) =>
        http.send(issue(key, '/watchers'), {
          method: 'PUT',
          body: validated(watchIssueBodySchema, { watching }),
        }),
      workLogs: async (key: string) =>
        (await http.request(issue(key, '/work-logs'), workLogsResponseSchema)).items,
      logWork: async (key: string, body: CreateWorkLogBody) =>
        http.request(issue(key, '/work-logs'), workLogSchema, {
          method: 'POST',
          body: validated(createWorkLogBodySchema, body),
          idempotent: true,
        }),
      history: async (key: string, filter: HistoryFilter = {}) =>
        http.request(issue(key, '/history'), issueHistoryPageSchema, {
          query: validated(listIssueHistoryQuerySchema, filter),
        }),
      /** Key or title prefix, for the link picker. */
      suggest: async (q: string, signal?: AbortSignal) =>
        (
          await http.request(`${BASE}/search/suggest`, suggestResponseSchema, {
            query: validated(suggestQuerySchema, { q }),
            ...(signal ? { signal } : {}),
          })
        ).items,
    },
  };
}
