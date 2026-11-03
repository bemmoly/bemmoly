import type { Http } from '@bemmoly/api-client';
import {
  CHANGE_REQUESTS_PATHS,
  changeRequestDetailSchema,
  changeRequestsPageSchema,
  type ListChangeRequestsQuery,
} from '@bemmoly/module-pipelines/shared';
import { toQuery } from './query.ts';

/** Change requests and their approvals (stream S3 fills these in). */
export const changeRequestsKeys = {
  all: ['pipelines', 'change-requests'] as const,
  list: (query: Partial<ListChangeRequestsQuery>) =>
    ['pipelines', 'change-requests', 'list', query] as const,
  detail: (number: string) => ['pipelines', 'change-requests', 'detail', number] as const,
};

export function changeRequestsEndpoints(http: Http) {
  return {
    list: (query: Partial<ListChangeRequestsQuery>) =>
      http.request(CHANGE_REQUESTS_PATHS.list, changeRequestsPageSchema, {
        query: toQuery(query),
      }),
    detail: (number: string) =>
      http.request(CHANGE_REQUESTS_PATHS.request(number), changeRequestDetailSchema),
  };
}
