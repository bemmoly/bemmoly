import type { ApplicationFilters, ListApplicationsQuery } from '@bemmoly/module-pipelines/shared';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';
import { pipelinesKeys } from '../../api/pipelines.ts';
import { useScope } from '../../hooks/use-scope.ts';
import { api } from '../../lib/api.ts';
import {
  catalogQuery,
  readCatalog,
  writeCatalog,
  type CatalogSearch,
  type CatalogState,
  type FacetKey,
} from './catalog-search.ts';

const PAGE = 100;

/** The catalog's state from the address, and a writer that keeps the scope in step. */
export function useCatalogState() {
  const search = useSearch({ strict: false }) as CatalogSearch;
  const navigate = useNavigate();
  const scope = useScope();
  const state = useMemo(() => readCatalog(search), [search]);
  const commit = useCallback(
    (next: CatalogState, nextScope: string = scope.path, replace = false) =>
      void navigate({ to: '.', search: writeCatalog(next, nextScope || undefined), replace }),
    [navigate, scope.path],
  );
  /** Domains move the scope: one domain is the scope, several are a filter at the top. */
  const toggle = useCallback(
    (key: FacetKey, value: string) => {
      if (key !== 'domain') {
        const current = state.facets[key];
        const next = current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value];
        commit({ ...state, facets: { ...state.facets, [key]: next } });
        return;
      }
      const chosen = state.facets.domain.length
        ? state.facets.domain
        : scope.domain
          ? [scope.domain]
          : [];
      const next = chosen.includes(value)
        ? chosen.filter((item) => item !== value)
        : [...chosen, value];
      const one = next.length === 1 ? (next[0] ?? '') : '';
      commit({ ...state, facets: { ...state.facets, domain: one ? [] : next } }, one);
    },
    [commit, scope.domain, state],
  );
  const domains = state.facets.domain.length
    ? state.facets.domain
    : scope.domain
      ? [scope.domain]
      : [];
  return { state, scope, commit, toggle, domains };
}

/** The list, a keyset page at a time; the previous list stays while a filter changes. */
export function useApplicationsList(query: Partial<ListApplicationsQuery>) {
  return useInfiniteQuery({
    queryKey: pipelinesKeys.applications({ ...query, limit: PAGE }),
    queryFn: ({ pageParam }) =>
      api.pipelines.applications({
        ...query,
        limit: PAGE,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
}

export function useFacets(query: Partial<ListApplicationsQuery>) {
  const filters = Object.fromEntries(
    Object.entries(query).filter(([key]) => !['sort', 'cursor', 'limit'].includes(key)),
  );
  return useQuery({
    queryKey: pipelinesKeys.facets(filters as ApplicationFilters),
    queryFn: () => api.pipelines.facets(filters as ApplicationFilters),
    placeholderData: keepPreviousData,
  });
}

/** How many match a filter, for the saved views' counts: one row, the total only. */
export function useCount(query: Partial<ListApplicationsQuery>) {
  return useQuery({
    queryKey: pipelinesKeys.applications({ ...query, limit: 1 }),
    queryFn: () => api.pipelines.applications({ ...query, limit: 1 }),
    select: (page) => page.total,
    staleTime: 60_000,
  });
}

export { catalogQuery };
