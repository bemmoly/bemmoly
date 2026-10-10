import { describe, expect, it, vi } from 'vitest';
import { paletteItems, type PaletteSources } from './command-items.ts';
import { inPlace, readPlace } from './use-palette-place.ts';

const sources = (searchHits: PaletteSources['searchHits']): PaletteSources => ({
  viewer: { isAdmin: false, capabilities: [] },
  canManagePeople: false,
  modules: [],
  users: [],
  searchHits,
  run: { invite: vi.fn(), shortcuts: vi.fn(), mode: vi.fn(), signOut: vi.fn() },
});

const page = (id: string, key: string) => ({
  kind: 'docs.page',
  group: 'Pages',
  id,
  key,
  title: `Page ${id}`,
  subtitle: 'Draft',
  context: key === 'ENG' ? 'Engineering › Platform' : 'Product',
  snippet: 'moves to <b>Postgres</b>',
  look: { icon: null },
  href: `/docs/p/${id}`,
});

const issue = {
  kind: 'work.issue',
  group: 'Issues',
  id: 'i1',
  key: 'PLT-204',
  title: 'Session store',
  subtitle: null,
  href: '/work/issues/PLT-204',
  look: { type: { key: 'story', icon: null, color: null, level: null } },
};

describe('pages in the palette', () => {
  it('draw a page with its icon, place and matching line, and no key', () => {
    const [row] = paletteItems(sources([page('p1', 'ENG')]));
    expect(row).toMatchObject({
      subtitle: 'Engineering › Platform',
      recordIcon: null,
      snippet: 'moves to <b>Postgres</b>',
      placeKey: 'ENG',
    });
    expect(row?.issueKey).toBeUndefined();
  });

  it('keep pages to the place and leave issues alone', () => {
    const items = paletteItems(sources([page('p1', 'ENG'), page('p2', 'PROD'), issue]));
    const place = { key: 'ENG', label: 'Engineering', kind: 'docs.page' };
    const kept = inPlace(items, place).filter((item) => item.fromServer);
    expect(kept.map((item) => item.title)).toEqual(['Page p1', 'Session store']);
    expect(inPlace(items, null).filter((item) => item.fromServer)).toHaveLength(3);
  });

  it('read the place a module screen marks', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<div data-search-place="ENG" data-search-place-label="Engineering" data-search-place-kind="docs.page"></div>';
    expect(readPlace(root)).toEqual({ key: 'ENG', label: 'Engineering', kind: 'docs.page' });
    expect(readPlace(document.createElement('div'))).toBeNull();
  });
});
