import { useMemo } from 'react';
import { joinParam, listParam, setSearchParams, useSearch } from './url-state.ts';

/*
 * The one filter model Board and Backlog share. It lives in the address, so a filtered board
 * can be shared as a link and survives a reload, and both screens answer it the same way: an
 * issue that does not match is not shown, and every count follows.
 */

export type FacetKey = 'assignee' | 'epic' | 'type' | 'label';

/** Built-in quick filters; a board's own quick filters add ids of the form "board-<n>". */
export type BuiltInQuick = 'mine' | 'blocked' | 'recent';

export interface IssueFilters {
  /** Free text over the key and the title. */
  q: string;
  /** User ids; "none" stands for unassigned. */
  assignee: readonly string[];
  /** Epic ids; "none" stands for no epic. */
  epic: readonly string[];
  type: readonly string[];
  label: readonly string[];
  quick: readonly string[];
  /** An applied LQL query, from a saved view or typed in the query bar. */
  lql: string;
  /** The saved view the query came from, so its name shows on the chip. */
  view: string | null;
}

export const FACETS: readonly FacetKey[] = ['assignee', 'epic', 'type', 'label'];

export const NO_FILTERS: IssueFilters = {
  q: '',
  assignee: [],
  epic: [],
  type: [],
  label: [],
  quick: [],
  lql: '',
  view: null,
};

export function parseFilters(search: string): IssueFilters {
  const params = new URLSearchParams(search);
  return {
    q: params.get('q') ?? '',
    assignee: listParam(params.get('assignee')),
    epic: listParam(params.get('epic')),
    type: listParam(params.get('type')),
    label: listParam(params.get('label')),
    quick: listParam(params.get('quick')),
    lql: params.get('lql') ?? '',
    view: params.get('view'),
  };
}

export function isFiltered(filters: IssueFilters): boolean {
  return (
    filters.q.trim() !== '' ||
    filters.lql !== '' ||
    filters.quick.length > 0 ||
    FACETS.some((facet) => filters[facet].length > 0)
  );
}

/** What an issue offers the client-side filters; the server answers the LQL ones. */
export interface Filterable {
  key: string;
  title: string;
  assigneeId: string | null;
  parentId: string | null;
  typeId: string;
  labelIds: readonly string[];
  blocked: boolean;
  /** ISO time of the last change, for "Recently updated" where the server is not asked. */
  updatedAt?: string;
}

const DAY = 86_400_000;

/** Whether an issue passes the filters answered on the client. */
export function matchesFilters(
  item: Filterable,
  filters: IssueFilters,
  meId: string | undefined,
  now = Date.now(),
): boolean {
  const text = filters.q.trim().toLowerCase();
  if (text && !item.title.toLowerCase().includes(text) && !item.key.toLowerCase().includes(text))
    return false;
  if (filters.quick.includes('mine') && item.assigneeId !== (meId ?? null)) return false;
  if (filters.quick.includes('blocked') && !item.blocked) return false;
  if (
    filters.quick.includes('recent') &&
    item.updatedAt !== undefined &&
    now - Date.parse(item.updatedAt) > DAY
  )
    return false;
  const one = (list: readonly string[], value: string | null) =>
    list.length === 0 || list.includes(value ?? 'none');
  if (!one(filters.assignee, item.assigneeId)) return false;
  if (!one(filters.epic, item.parentId)) return false;
  if (!one(filters.type, item.typeId)) return false;
  if (filters.label.length > 0 && !item.labelIds.some((id) => filters.label.includes(id)))
    return false;
  return true;
}

const flip = (list: readonly string[], id: string) =>
  list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];

/** The filters from the address, and the ways to change them. */
export function useIssueFilters() {
  const search = useSearch();
  const filters = useMemo(() => parseFilters(search), [search]);
  return useMemo(
    () => ({
      filters,
      filtered: isFiltered(filters),
      setText: (q: string) => setSearchParams({ q }),
      toggle: (key: FacetKey | 'quick', id: string) =>
        setSearchParams({ [key]: joinParam(flip(filters[key], id)) }),
      remove: (key: FacetKey | 'quick', id: string) =>
        setSearchParams({ [key]: joinParam(filters[key].filter((entry) => entry !== id)) }),
      setQuery: (lql: string, view: string | null = null) =>
        setSearchParams({ lql: lql.trim(), view }),
      clear: () =>
        setSearchParams({
          q: null,
          assignee: null,
          epic: null,
          type: null,
          label: null,
          quick: null,
          lql: null,
          view: null,
        }),
    }),
    [filters],
  );
}

export type IssueFilterApi = ReturnType<typeof useIssueFilters>;
