import { queryKeys } from '@bemmoly/api-client';
import type { AiCatalogProviderSummary, AiCatalogResponse } from '@bemmoly/shared';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import bundled from '../fixtures/ai-catalog.json' with { type: 'json' };
import { api } from '../lib/api.ts';
import { LOCAL_AI, NO_AI } from '../store/setup.ts';

/** What the picker needs of a provider; the API's catalog summary has all of it and more. */
export interface CatalogProvider {
  id: string;
  name: string;
  /** Credential and setting names the provider package reads, in the catalog's order. */
  env: readonly string[];
  /** Base URL, when the provider needs one; null means the package default. */
  api: string | null;
  doc: string;
  npm: string;
  /** The server's cached copy of the catalog logo, when it has one. */
  logoUrl?: string | null;
  /** "compatible": loaded through the generic client over its base URL, which the form says. */
  loader?: AiCatalogProviderSummary['loader'];
}

export interface AiCatalog {
  popular: readonly string[];
  providers: readonly CatalogProvider[];
}

/**
 * The copy of the catalog shipped in the web build. Only for naming a provider where the live
 * catalog is not loaded (the wizard's summary); every picker reads the server's catalog.
 */
export const BUNDLED_CATALOG: AiCatalog = bundled as AiCatalog;

/** A model server on the admin's own network; not in the catalog, so described here. */
export const LOCAL_SERVER: CatalogProvider = {
  id: LOCAL_AI,
  name: 'Local server',
  env: [],
  api: null,
  doc: '',
  npm: '',
};

/** Two letters for the tile of a provider with no logo. */
export function initialsOf(name: string): string {
  const words = name.split(/[\s-]+/).filter(Boolean);
  const letters =
    words.length > 1 ? `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}` : name.slice(0, 2);
  return letters.toUpperCase();
}

/** The Popular row in catalog order; ids missing from the catalog are dropped. */
export function popularProviders(catalog: AiCatalog): CatalogProvider[] {
  return catalog.popular.flatMap((id) => {
    const provider = catalog.providers.find((entry) => entry.id === id);
    return provider ? [provider] : [];
  });
}

const fold = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** The full list: sorted by name, filtered on name or id, case and accent insensitive. */
export function searchProviders(catalog: AiCatalog, query: string): CatalogProvider[] {
  const needle = fold(query.trim());
  return [...catalog.providers]
    .filter(
      (provider) => !needle || fold(provider.name).includes(needle) || provider.id.includes(needle),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

/** A picker choice as a provider; null for "No AI for now" or an unknown id. */
export function providerFor(catalog: AiCatalog, id: string | null): CatalogProvider | null {
  if (!id || id === NO_AI) return null;
  if (id === LOCAL_AI) return LOCAL_SERVER;
  return catalog.providers.find((provider) => provider.id === id) ?? null;
}

export const aiCatalogQuery = queryOptions({
  queryKey: queryKeys.ai.catalog(),
  queryFn: () => api.ai.catalog.get(),
  staleTime: 60_000,
});

/** One catalog provider's models, with the roles each qualifies for and the suggested ones. */
export const catalogModelsQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.ai.catalogProvider(id),
    queryFn: () => api.ai.catalog.provider(id),
    staleTime: 5 * 60_000,
  });

export function useCatalogModels(id: string | null) {
  return useQuery({ ...catalogModelsQuery(id ?? ''), enabled: Boolean(id) });
}

const EMPTY: AiCatalogResponse = {
  status: {
    source: 'bundled',
    offline: true,
    fetchedAt: null,
    bundledWith: null,
    line: '',
    liveFetch: true,
    providerCount: 0,
    modelCount: 0,
  },
  popular: [],
  providers: [],
};

/** The picker's data from the server's catalog: Popular row, the searchable list, status. */
export function useAiCatalog(query: string) {
  const catalogQuery = useQuery(aiCatalogQuery);
  const catalog = catalogQuery.data ?? EMPTY;
  const popular = useMemo(() => popularProviders(catalog), [catalog]);
  const results = useMemo(() => searchProviders(catalog, query), [catalog, query]);
  return {
    query: catalogQuery,
    status: catalog.status,
    popular,
    local: LOCAL_SERVER,
    results,
    total: catalog.providers.length,
    find: (id: string | null) => providerFor(catalog, id),
  };
}
