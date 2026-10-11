import type { Project } from '@bemmoly/module-work/shared';
import type { TableSort } from '@bemmoly/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type ProjectSegment = 'all' | 'starred' | 'archived';
export type ProjectLayout = 'list' | 'grid';

export interface ProjectsViewState {
  q: string;
  segment: ProjectSegment;
  layout: ProjectLayout;
  sort: TableSort;
}

const DEFAULT_SORT: TableSort = { key: 'name', direction: 'asc' };
const SEGMENTS: readonly ProjectSegment[] = ['all', 'starred', 'archived'];
const SORT_KEYS = ['name', 'key', 'updated'];

/** Reads the view from the address, so a reload or a shared link opens the same list. */
export function readView(search: string): ProjectsViewState {
  const params = new URLSearchParams(search);
  const segment = params.get('show') as ProjectSegment | null;
  const [key = '', direction] = (params.get('sort') ?? '').split('.');
  return {
    q: params.get('q') ?? '',
    segment: segment && SEGMENTS.includes(segment) ? segment : 'all',
    layout: params.get('view') === 'grid' ? 'grid' : 'list',
    sort: SORT_KEYS.includes(key)
      ? { key, direction: direction === 'desc' ? 'desc' : 'asc' }
      : DEFAULT_SORT,
  };
}

/** Writes the view back, leaving defaults out so the plain address stays plain. */
export function writeView(view: ProjectsViewState): string {
  const params = new URLSearchParams();
  if (view.q) params.set('q', view.q);
  if (view.segment !== 'all') params.set('show', view.segment);
  if (view.layout !== 'list') params.set('view', view.layout);
  if (view.sort.key !== DEFAULT_SORT.key || view.sort.direction !== DEFAULT_SORT.direction)
    params.set('sort', `${view.sort.key}.${view.sort.direction}`);
  const text = params.toString();
  return text ? `?${text}` : '';
}

const compare: Record<string, (a: Project, b: Project) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  key: (a, b) => a.key.localeCompare(b.key),
  updated: (a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt),
};

/** The rows a view shows: segment, then search over name, key and description, then sort. */
export function viewRows(
  projects: readonly Project[],
  view: ProjectsViewState,
  isStarred: (key: string) => boolean,
): Project[] {
  const needle = view.q.trim().toLowerCase();
  const rows = projects.filter((project) => {
    const archived = project.archivedAt !== null;
    if (view.segment === 'archived' ? !archived : archived) return false;
    if (view.segment === 'starred' && !isStarred(project.key)) return false;
    if (!needle) return true;
    return [project.name, project.key, project.description ?? ''].some((text) =>
      text.toLowerCase().includes(needle),
    );
  });
  const by = compare[view.sort.key] ?? compare['name'];
  const sign = view.sort.direction === 'asc' ? 1 : -1;
  return rows.sort((a, b) => sign * (by?.(a, b) ?? 0));
}

/**
 * The Projects view in the URL: changes replace the history entry (typing in the search is
 * not a trail of Back steps) and Back or Forward from elsewhere reads it again.
 */
export function useProjectsView() {
  const [view, setView] = useState(() => readView(window.location.search));
  useEffect(() => {
    const reread = () => setView(readView(window.location.search));
    window.addEventListener('popstate', reread);
    return () => window.removeEventListener('popstate', reread);
  }, []);
  const update = useCallback((patch: Partial<ProjectsViewState>) => {
    setView((current) => {
      const next = { ...current, ...patch };
      const url = `${window.location.pathname}${writeView(next)}${window.location.hash}`;
      window.history.replaceState(window.history.state, '', url);
      return next;
    });
  }, []);
  return useMemo(() => ({ view, update }), [view, update]);
}
