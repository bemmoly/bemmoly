import type { ApplicationSort, ListApplicationsQuery } from '@bemmoly/module-pipelines/shared';

/*
 * The catalog's state lives in the address: every facet, the search, the sort. These read
 * the raw search (the router turns "0" into a number and "true" into a boolean) into the
 * list query the API takes, and write a change back as plain strings.
 */

export const FACET_KEYS = ['domain', 'team', 'tier', 'runtime', 'lifecycle', 'health'] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

export type CatalogSearch = Record<string, unknown>;

export interface CatalogState {
  q: string;
  facets: Record<FacetKey, string[]>;
  mine: boolean;
  staleDays: number | null;
  sort: ApplicationSort;
}

const list = (value: unknown): string[] =>
  value === undefined || value === null || value === ''
    ? []
    : String(value)
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);

export function readCatalog(search: CatalogSearch): CatalogState {
  const facets = Object.fromEntries(FACET_KEYS.map((key) => [key, list(search[key])])) as Record<
    FacetKey,
    string[]
  >;
  const stale = Number(search['staleDays']);
  const sort = String(search['sort'] ?? 'name');
  return {
    q:
      typeof search['q'] === 'string' || typeof search['q'] === 'number' ? String(search['q']) : '',
    facets,
    mine: search['mine'] === true || search['mine'] === 'true',
    staleDays: Number.isInteger(stale) && stale > 0 ? stale : null,
    sort: sort === 'recent' || sort === 'tier' ? sort : 'name',
  };
}

/** The scope narrows the catalog the way a domain or group facet would. */
export function catalogQuery(
  state: CatalogState,
  scope: { domain: string | null; group: string | null },
): Partial<ListApplicationsQuery> {
  const query: Record<string, unknown> = { sort: state.sort };
  if (state.q) query['q'] = state.q;
  for (const key of FACET_KEYS) if (state.facets[key].length) query[key] = state.facets[key];
  if (scope.domain && !state.facets.domain.length) query['domain'] = [scope.domain];
  if (scope.domain && scope.group) query['group'] = [`${scope.domain}/${scope.group}`];
  if (state.mine) query['mine'] = true;
  if (state.staleDays) query['staleDays'] = state.staleDays;
  return query as Partial<ListApplicationsQuery>;
}

/** The search for a state, with empty values left out so the address stays short. */
export function writeCatalog(state: CatalogState, scope: string | undefined): CatalogSearch {
  const search: CatalogSearch = {};
  if (scope) search['scope'] = scope;
  if (state.q) search['q'] = state.q;
  for (const key of FACET_KEYS)
    if (state.facets[key].length) search[key] = state.facets[key].join(',');
  if (state.mine) search['mine'] = 'true';
  if (state.staleDays) search['staleDays'] = String(state.staleDays);
  if (state.sort !== 'name') search['sort'] = state.sort;
  return search;
}

export const EMPTY_FACETS: Record<FacetKey, string[]> = {
  domain: [],
  team: [],
  tier: [],
  runtime: [],
  lifecycle: [],
  health: [],
};

/** The filters a saved view holds: the search and facets, not the sort or the scope. */
export interface ViewFilters {
  q?: string;
  facets?: Partial<Record<FacetKey, string[]>>;
  mine?: boolean;
  staleDays?: number;
}

export function sameFilters(state: CatalogState, view: ViewFilters): boolean {
  if ((view.q ?? '') !== state.q) return false;
  if (Boolean(view.mine) !== state.mine) return false;
  if ((view.staleDays ?? null) !== state.staleDays) return false;
  return FACET_KEYS.every((key) => {
    const a = [...(view.facets?.[key] ?? [])].sort().join(',');
    const b = [...state.facets[key]].sort().join(',');
    return a === b;
  });
}

export function applyView(state: CatalogState, view: ViewFilters): CatalogState {
  return {
    ...state,
    q: view.q ?? '',
    facets: { ...EMPTY_FACETS, ...view.facets },
    mine: Boolean(view.mine),
    staleDays: view.staleDays ?? null,
  };
}
