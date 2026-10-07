import { describe, expect, it } from 'vitest';
import {
  BUNDLED_CATALOG,
  catalogStatus,
  connectionShell,
  initialsOf,
  LOCAL_SERVER,
  popularProviders,
  providerFor,
  searchProviders,
  type AiCatalog,
} from './use-ai-catalog.ts';

const byName = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' });

describe('AI catalog', () => {
  it('says where the catalog came from', () => {
    expect(catalogStatus(BUNDLED_CATALOG)).toBe('Offline · bundled with 0.1.0');
  });

  it('orders the Popular row by the catalog list and drops unknown ids', () => {
    const popular = popularProviders(BUNDLED_CATALOG).map((provider) => provider.id);
    expect(popular).toEqual(BUNDLED_CATALOG.popular);
    expect(popular).toHaveLength(6);
    const trimmed: AiCatalog = { ...BUNDLED_CATALOG, popular: ['missing', ...popular.slice(0, 1)] };
    expect(popularProviders(trimmed).map((provider) => provider.id)).toEqual(popular.slice(0, 1));
  });

  it('lists every provider sorted by name when the search is empty', () => {
    const names = searchProviders(BUNDLED_CATALOG, '  ').map((provider) => provider.name);
    expect(names).toHaveLength(BUNDLED_CATALOG.providers.length);
    expect(names).toEqual([...names].sort(byName));
    expect(BUNDLED_CATALOG.providers.length).toBeGreaterThanOrEqual(30);
  });

  it('filters on name or id, ignoring case', () => {
    const target = BUNDLED_CATALOG.providers.find((provider) => provider.name.includes(' '));
    expect(target).toBeDefined();
    const word = target?.name.split(' ')[1]?.toUpperCase() ?? '';
    expect(searchProviders(BUNDLED_CATALOG, word).map((p) => p.id)).toContain(target?.id);
    const byId = BUNDLED_CATALOG.providers.find((provider) => provider.id.includes('-'));
    expect(searchProviders(BUNDLED_CATALOG, byId?.id ?? '').map((p) => p.id)).toContain(byId?.id);
    expect(searchProviders(BUNDLED_CATALOG, 'zzzz-nothing')).toEqual([]);
  });

  it('resolves stored ids, the local server and no AI', () => {
    const first = BUNDLED_CATALOG.providers[0];
    expect(providerFor(BUNDLED_CATALOG, first?.id ?? '')).toBe(first);
    expect(providerFor(BUNDLED_CATALOG, 'local')).toBe(LOCAL_SERVER);
    expect(providerFor(BUNDLED_CATALOG, 'none')).toBeNull();
    expect(providerFor(BUNDLED_CATALOG, null)).toBeNull();
    expect(providerFor(BUNDLED_CATALOG, 'unknown')).toBeNull();
  });

  it('builds a disabled connection form with one secret field per catalog entry', () => {
    const withBase = BUNDLED_CATALOG.providers.find(
      (provider) => provider.api && provider.env.length > 1,
    );
    const shell = connectionShell({
      id: 'x',
      name: 'X',
      env: ['X_KEY', 'X_REGION'],
      api: 'https://x.example/v1',
      doc: 'https://x.example/docs',
      npm: 'x',
    });
    expect(shell.fields).toEqual([
      { name: 'X_KEY', type: 'password' },
      { name: 'X_REGION', type: 'password' },
    ]);
    expect(shell.baseUrl).toBe('https://x.example/v1');
    expect(shell.disabled).toBe(true);
    expect(shell.note).toContain('later release');
    expect(connectionShell(withBase ?? LOCAL_SERVER).baseUrl).toBe(withBase?.api ?? '');
  });

  it('makes two-letter tiles', () => {
    expect(initialsOf('Local server')).toBe('LS');
    expect(initialsOf('Acme')).toBe('AC');
    expect(initialsOf('deep-infra')).toBe('DI');
  });
});
