import type { BoardConfig } from '@bemmoly/module-work/shared';
import { create } from 'zustand';
import { matchesFilters, type IssueFilters } from '../shared/issue-filters.ts';
import type { ViewCard } from './board-model.ts';

/*
 * The Board's side of the shared filter model (shared/issue-filters.ts, kept in the address).
 * Search, people, epics, types, labels and the "mine" and "blocked" chips are answered on the
 * client from the cards already loaded; the query bar and the LQL quick filters go to the
 * server as one `q`. A card that does not match leaves the board, and every count follows.
 */

export interface QuickFilter {
  id: string;
  name: string;
  /** Sent to the server; absent for the chips answered on the client. */
  query?: string;
}

/** The built-in chips first, then the board's own from Board settings. */
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

interface LaneState {
  collapsed: readonly string[];
  toggle(laneId: string): void;
  reset(): void;
}

/** Which lanes are folded; per visit, not shared in the address. */
export const useBoardLanes = create<LaneState>()((set) => ({
  collapsed: [],
  toggle: (laneId) =>
    set((state) => ({
      collapsed: state.collapsed.includes(laneId)
        ? state.collapsed.filter((id) => id !== laneId)
        : [...state.collapsed, laneId],
    })),
  reset: () => set({ collapsed: [] }),
}));

export type BoardFilters = Pick<
  IssueFilters,
  'q' | 'lql' | 'quick' | 'assignee' | 'epic' | 'type' | 'label'
>;

/** The `q` for the board view: the query bar and every active LQL chip, all of them true. */
export function serverQuery(
  filters: Pick<IssueFilters, 'lql' | 'quick'>,
  quick: readonly QuickFilter[],
): string {
  const parts = [
    filters.lql,
    ...quick.filter((chip) => filters.quick.includes(chip.id) && chip.query).map((c) => c.query),
  ].filter((part): part is string => Boolean(part));
  if (parts.length <= 1) return parts[0] ?? '';
  return parts.map((part) => `(${part})`).join(' AND ');
}

export function hasClientFilters(filters: BoardFilters): boolean {
  return (
    filters.q.trim() !== '' ||
    filters.quick.includes('mine') ||
    filters.quick.includes('blocked') ||
    filters.assignee.length + filters.epic.length + filters.type.length + filters.label.length > 0
  );
}

/** Whether a card passes the filters answered on the client; "recent" is the server's. */
export function cardMatches(card: ViewCard, filters: BoardFilters, meId: string | undefined) {
  return matchesFilters(
    {
      key: card.key,
      title: card.title,
      assigneeId: card.assigneeId,
      parentId: card.parentId,
      typeId: card.typeId,
      labelIds: card.labelIds,
      blocked: card.blockedBy.length > 0,
    },
    { ...filters, view: null },
    meId,
  );
}
