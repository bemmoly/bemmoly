import type { Http, Query } from '@bemmoly/api-client';
import {
  applicationFacetsSchema,
  applicationSchema,
  applicationsPageSchema,
  domainsResponseSchema,
  environmentPathsResponseSchema,
  environmentsResponseSchema,
  groupsPageSchema,
  overviewSchema,
  teamsPageSchema,
  type ApplicationFilters,
  type ListApplicationsQuery,
} from '@bemmoly/module-pipelines/shared';

const base = '/api/v1/pipelines';

/** Filters as the query string sends them: lists joined with commas, as the server reads them. */
function filterQuery(filters: Partial<ListApplicationsQuery>): Query {
  const query: Record<string, string | number | boolean | undefined> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;
    query[key] = Array.isArray(value) ? value.join(',') : (value as string | number | boolean);
  }
  return query;
}

/** Query keys, under one root so a stream event can invalidate a whole family. */
export const pipelinesKeys = {
  all: ['pipelines'] as const,
  overview: (scope: string) => ['pipelines', 'overview', scope] as const,
  domains: () => ['pipelines', 'domains'] as const,
  groups: (domain: string) => ['pipelines', 'groups', domain] as const,
  applications: (query: Partial<ListApplicationsQuery>) =>
    ['pipelines', 'applications', query] as const,
  application: (key: string) => ['pipelines', 'application', key] as const,
  facets: (filters: ApplicationFilters) => ['pipelines', 'facets', filters] as const,
  environments: () => ['pipelines', 'environments'] as const,
  teams: (mine: boolean) => ['pipelines', 'teams', mine] as const,
};

/** /api/v1/pipelines: the reads the shell and the screens share. */
export function pipelinesEndpoints(http: Http) {
  return {
    overview: (scope: string) =>
      http.request(`${base}/overview`, overviewSchema, { query: scope ? { scope } : {} }),
    domains: () => http.request(`${base}/domains`, domainsResponseSchema),
    groups: (domain: string) =>
      http.request(`${base}/groups`, groupsPageSchema, { query: { domain, limit: 200 } }),
    applications: (query: Partial<ListApplicationsQuery>) =>
      http.request(`${base}/applications`, applicationsPageSchema, { query: filterQuery(query) }),
    application: (key: string) =>
      http.request(`${base}/applications/${encodeURIComponent(key)}`, applicationSchema),
    facets: (filters: ApplicationFilters) =>
      http.request(`${base}/applications/facets`, applicationFacetsSchema, {
        query: filterQuery(filters),
      }),
    environments: () => http.request(`${base}/environments`, environmentsResponseSchema),
    paths: () => http.request(`${base}/environments/paths`, environmentPathsResponseSchema),
    teams: (mine: boolean) =>
      http.request(`${base}/teams`, teamsPageSchema, { query: { mine, limit: 200 } }),
    /** The URL of the live stream for these topics; EventSource sends the session cookie. */
    streamUrl: (topics: readonly string[]) =>
      http.url(`${base}/streams`, { topics: topics.join(',') }),
  };
}
