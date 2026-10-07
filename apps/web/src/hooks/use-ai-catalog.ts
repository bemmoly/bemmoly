import { useMemo } from 'react';
import bundled from '../fixtures/ai-catalog.json' with { type: 'json' };
import { LOCAL_AI, NO_AI } from '../store/setup.ts';

/** One provider in the trimmed models.dev shape the AI runtime will also read. */
export interface CatalogProvider {
  id: string;
  name: string;
  /** Credential and setting names the provider package reads, in the catalog's order. */
  env: readonly string[];
  /** Base URL, when the provider needs one; null means the package default. */
  api: string | null;
  doc: string;
  npm: string;
}

export interface AiCatalog {
  /** "live" once the AI runtime fetches models.dev; 0.1.0 only ships the bundle. */
  source: 'bundled' | 'live';
  version: string;
  /** Catalog ids in display order for the Popular row; a UI ordering, not code. */
  popular: readonly string[];
  providers: readonly CatalogProvider[];
}

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

/** The status line under the picker, in the tech design's words. */
export function catalogStatus(catalog: AiCatalog): string {
  return catalog.source === 'bundled'
    ? `Offline · bundled with ${catalog.version}`
    : 'Live · models.dev';
}

/** Two letters for the tile until logos ship with the catalog snapshot. */
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

/** The full list: sorted by name, filtered on name or id, case and accent insensitive. */
export function searchProviders(catalog: AiCatalog, query: string): CatalogProvider[] {
  const fold = (text: string) =>
    text
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  const needle = fold(query.trim());
  return [...catalog.providers]
    .filter(
      (provider) => !needle || fold(provider.name).includes(needle) || provider.id.includes(needle),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

/** A stored ai.providerId as a provider; null for "No AI for now" or an unknown id. */
export function providerFor(catalog: AiCatalog, id: string | null): CatalogProvider | null {
  if (!id || id === NO_AI) return null;
  if (id === LOCAL_AI) return LOCAL_SERVER;
  return catalog.providers.find((provider) => provider.id === id) ?? null;
}

export interface ConnectionField {
  name: string;
  /** Every catalog field may hold a secret, so all are password-type; none is sent anywhere. */
  type: 'password';
}

export interface ConnectionShell {
  fields: ConnectionField[];
  baseUrl: string;
  doc: string;
  /** Inputs stay disabled until the AI runtime can test and store credentials. */
  disabled: true;
  note: string;
}

export const CONNECTION_NOTE =
  'Connecting a provider arrives with the AI runtime in a later release. Your choice is saved now.';

/** The connection form for a provider, built only from the catalog entry. */
export function connectionShell(provider: CatalogProvider): ConnectionShell {
  return {
    fields: provider.env.map((name) => ({ name, type: 'password' })),
    baseUrl: provider.api ?? '',
    doc: provider.doc,
    disabled: true,
    note: CONNECTION_NOTE,
  };
}

/** The picker's data: Popular row, the searchable full list and the status line. */
export function useAiCatalog(query: string, catalog: AiCatalog = BUNDLED_CATALOG) {
  const popular = useMemo(() => popularProviders(catalog), [catalog]);
  const results = useMemo(() => searchProviders(catalog, query), [catalog, query]);
  return {
    catalog,
    status: catalogStatus(catalog),
    popular,
    local: LOCAL_SERVER,
    results,
    total: catalog.providers.length,
    find: (id: string | null) => providerFor(catalog, id),
  };
}
