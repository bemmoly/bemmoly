import { describe, expect, it } from 'vitest';
import {
  applyView,
  catalogQuery,
  EMPTY_FACETS,
  readCatalog,
  sameFilters,
  writeCatalog,
} from './catalog-search.ts';

describe('the catalog in the address', () => {
  it('reads what the router hands over, numbers and booleans included', () => {
    const state = readCatalog({
      tier: 0,
      team: 'none,abc',
      mine: true,
      staleDays: '90',
      sort: 'tier',
      q: 42,
    });
    expect(state.facets.tier).toEqual(['0']);
    expect(state.facets.team).toEqual(['none', 'abc']);
    expect(state.mine).toBe(true);
    expect(state.staleDays).toBe(90);
    expect(state.sort).toBe('tier');
    expect(state.q).toBe('42');
  });

  it('falls back to safe values for nonsense', () => {
    const state = readCatalog({ sort: 'drop table', staleDays: '-3', mine: 'yes' });
    expect(state.sort).toBe('name');
    expect(state.staleDays).toBeNull();
    expect(state.mine).toBe(false);
  });

  it('narrows by the scope unless domains are chosen, and always by the scope group', () => {
    const state = readCatalog({});
    expect(catalogQuery(state, { domain: 'commerce', group: null }).domain).toEqual(['commerce']);
    expect(catalogQuery(state, { domain: 'commerce', group: 'checkout' }).group).toEqual([
      'commerce/checkout',
    ]);
    const chosen = readCatalog({ domain: 'data,finance' });
    expect(catalogQuery(chosen, { domain: 'commerce', group: null }).domain).toEqual([
      'data',
      'finance',
    ]);
  });

  it('writes only what is set, and round-trips', () => {
    const state = readCatalog({ q: 'pay', tier: '0,1', sort: 'recent' });
    const search = writeCatalog(state, 'commerce');
    expect(search).toEqual({ scope: 'commerce', q: 'pay', tier: '0,1', sort: 'recent' });
    expect(readCatalog(search)).toEqual(state);
  });

  it('knows a view by its filters, in any order', () => {
    const state = readCatalog({ tier: '1,0', mine: 'true' });
    expect(sameFilters(state, { mine: true, facets: { tier: ['0', '1'] } })).toBe(true);
    expect(sameFilters(state, { mine: true })).toBe(false);
    const applied = applyView(state, { staleDays: 90 });
    expect(applied.facets).toEqual(EMPTY_FACETS);
    expect(applied.staleDays).toBe(90);
    expect(applied.mine).toBe(false);
  });
});
