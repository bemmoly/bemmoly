import type { BoardConfig } from '@bemmoly/module-work/shared';
import { create } from 'zustand';
import type { BoardGrouping, ViewCard } from './board-model.ts';

/*
 * The filter row above the board. People, epics, types, labels, the search box and the
 * "mine" and "blocked" chips are answered on the client from the cards already loaded; the
 * LQL bar and the LQL quick filters go to the server as one `q`. A card that does not match
 * stays in place and fades, as the Board mock shows.
 */

export type FacetKey = 'people' | 'epics' | 'types' | 'labels';

export interface QuickFilter {
  id: string;
  name: string;
  /** Sent to the server; absent for the chips answered on the client. */
  query?: string;
}

/** The mock's three chips first, then the board's own from Board settings. */
export const BUILT_IN_QUICK_FILTERS: readonly QuickFilter[] = [
  { id: 'mine', name: 'Only my issues' },
  { id: 'recent', name: 'Recently updated', query: 'updated >= -1d' },
  { id: 'blocked', name: 'Blocked' },
];

export function quickFiltersOf(config: BoardConfig | undefined): QuickFilter[] {
  return [
    ...BUILT_IN_QUICK_FILTERS,
    ...(config?.quickFilters ?? []).map((filter, index) => ({
      id: `board-${index}`,
      name: filter.name,
      query: filter.query,
    })),
  ];
}

interface FilterState {
  search: string;
  /** The LQL the board is filtered by: what was last applied from the bar, not the draft. */
  lql: string;
  quick: readonly string[];
  people: readonly string[];
  epics: readonly string[];
  types: readonly string[];
  labels: readonly string[];
  grouping: BoardGrouping;
  collapsed: readonly string[];
  setSearch(search: string): void;
  setLql(lql: string): void;
  toggle(key: FacetKey | 'quick' | 'collapsed', id: string): void;
  setGrouping(grouping: BoardGrouping): void;
  reset(): void;
}

const EMPTY = {
  search: '',
  lql: '',
  quick: [],
  people: [],
  epics: [],
  types: [],
  labels: [],
  grouping: 'lanes' as BoardGrouping,
  collapsed: [],
};

const flip = (list: readonly string[], id: string) =>
  list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];

export const useBoardFilterStore = create<FilterState>()((set) => ({
  ...EMPTY,
  setSearch: (search) => set({ search }),
  setLql: (lql) => set({ lql: lql.trim() }),
  toggle: (key, id) => set((state) => ({ [key]: flip(state[key], id) })),
  setGrouping: (grouping) => set({ grouping }),
  reset: () => set(EMPTY),
}));

export type BoardFilters = Pick<
  FilterState,
  'search' | 'lql' | 'quick' | 'people' | 'epics' | 'types' | 'labels'
>;

/** The `q` for the board view: the LQL bar and every active LQL chip, all of them true. */
export function serverQuery(filters: BoardFilters, quick: readonly QuickFilter[]): string {
  const parts = [
    filters.lql,
    ...quick.filter((chip) => filters.quick.includes(chip.id) && chip.query).map((c) => c.query),
  ].filter((part): part is string => Boolean(part));
  if (parts.length <= 1) return parts[0] ?? '';
  return parts.map((part) => `(${part})`).join(' AND ');
}

export function hasClientFilters(filters: BoardFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.quick.includes('mine') ||
    filters.quick.includes('blocked') ||
    filters.people.length + filters.epics.length + filters.types.length + filters.labels.length > 0
  );
}

/** Whether a card passes the filters answered on the client. */
export function cardMatches(card: ViewCard, filters: BoardFilters, meId: string | undefined) {
  const text = filters.search.trim().toLowerCase();
  if (text && !card.title.toLowerCase().includes(text) && !card.key.toLowerCase().includes(text))
    return false;
  if (filters.quick.includes('mine') && card.assigneeId !== (meId ?? null)) return false;
  if (filters.quick.includes('blocked') && card.blockedBy.length === 0) return false;
  if (filters.people.length > 0 && !filters.people.includes(card.assigneeId ?? 'none'))
    return false;
  if (filters.epics.length > 0 && !filters.epics.includes(card.parentId ?? 'none')) return false;
  if (filters.types.length > 0 && !filters.types.includes(card.typeId)) return false;
  if (filters.labels.length > 0 && !card.labelIds.some((id) => filters.labels.includes(id)))
    return false;
  return true;
}
