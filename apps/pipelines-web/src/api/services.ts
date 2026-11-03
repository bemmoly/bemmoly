import type { Http } from '@bemmoly/api-client';
import {
  forYouSummarySchema,
  SERVICE_VIEWS_PATHS,
  serviceResponseSchema,
  servicesResponseSchema,
  serviceVersionsResponseSchema,
  type ListServicesQuery,
} from '@bemmoly/module-pipelines/shared';
import { toQuery } from './query.ts';

/** Under the application's own key, so a service's live events refresh its page too. */
export const servicesKeys = {
  list: (query: ListServicesQuery) => ['pipelines', 'services', query] as const,
  service: (key: string) => ['pipelines', 'application', key, 'service'] as const,
  versions: (key: string) => ['pipelines', 'application', key, 'versions'] as const,
  forYou: () => ['pipelines', 'for-you', 'summary'] as const,
};

/** Services, one service, its versions and For you's summary. */
export function servicesEndpoints(http: Http) {
  return {
    list: (query: ListServicesQuery) =>
      http.request(SERVICE_VIEWS_PATHS.list, servicesResponseSchema, { query: toQuery(query) }),
    service: (key: string) => http.request(SERVICE_VIEWS_PATHS.service(key), serviceResponseSchema),
    versions: (key: string) =>
      http.request(SERVICE_VIEWS_PATHS.versions(key), serviceVersionsResponseSchema),
    forYou: () => http.request(SERVICE_VIEWS_PATHS.forYou, forYouSummarySchema),
  };
}
