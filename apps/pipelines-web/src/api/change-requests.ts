import type { Http } from '@bemmoly/api-client';
import {
  CHANGE_REQUESTS_PATHS,
  changeRequestDetailSchema,
  changeRequestOptionsSchema,
  changeRequestsPageSchema,
  type ChangeRequestOptionsQuery,
  type CreateChangeRequestBody,
  type ListChangeRequestsQuery,
  type RejectChangeRequestBody,
  type UpdateChangeRequestBody,
} from '@bemmoly/module-pipelines/shared';
import { toQuery } from './query.ts';

/** Change requests and their approvals. */
export const changeRequestsKeys = {
  all: ['pipelines', 'change-requests'] as const,
  list: (query: Partial<ListChangeRequestsQuery>) =>
    ['pipelines', 'change-requests', 'list', query] as const,
  detail: (number: string) => ['pipelines', 'change-requests', 'detail', number] as const,
  options: (query: Partial<ChangeRequestOptionsQuery>) =>
    ['pipelines', 'change-requests', 'options', query] as const,
};

export function changeRequestsEndpoints(http: Http) {
  const detail = changeRequestDetailSchema;
  return {
    list: (query: Partial<ListChangeRequestsQuery>) =>
      http.request(CHANGE_REQUESTS_PATHS.list, changeRequestsPageSchema, {
        query: toQuery(query),
      }),
    detail: (number: string) => http.request(CHANGE_REQUESTS_PATHS.request(number), detail),
    options: (query: Partial<ChangeRequestOptionsQuery>) =>
      http.request(CHANGE_REQUESTS_PATHS.options, changeRequestOptionsSchema, {
        query: toQuery(query),
      }),
    create: (body: CreateChangeRequestBody) =>
      http.request(CHANGE_REQUESTS_PATHS.list, detail, { method: 'POST', body, idempotent: true }),
    update: (number: string, body: UpdateChangeRequestBody) =>
      http.request(CHANGE_REQUESTS_PATHS.request(number), detail, { method: 'PATCH', body }),
    send: (number: string) =>
      http.request(CHANGE_REQUESTS_PATHS.send(number), detail, { method: 'POST', body: {} }),
    approve: (number: string, note?: string) =>
      http.request(CHANGE_REQUESTS_PATHS.approve(number), detail, {
        method: 'POST',
        body: note ? { note } : {},
      }),
    reject: (number: string, body: RejectChangeRequestBody) =>
      http.request(CHANGE_REQUESTS_PATHS.reject(number), detail, { method: 'POST', body }),
    withdraw: (number: string, reason?: string) =>
      http.request(CHANGE_REQUESTS_PATHS.withdraw(number), detail, {
        method: 'POST',
        body: reason ? { reason } : {},
      }),
  };
}
