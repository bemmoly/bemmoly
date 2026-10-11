import {
  ROADMAP_GROUPS,
  ROADMAP_ZOOMS,
  type RoadmapGroup,
  type RoadmapZoom,
} from '@bemmoly/module-work/shared';
import { useCallback, useMemo } from 'react';
import { listParam, setSearchParams, useSearchSlice } from '../shared/url-state.ts';
import type { RoadmapFilters } from './roadmap-model.ts';

/*
 * The Roadmap's view in the address, so a link reproduces it: the zoom, the grouping, what
 * shows (versions, done items), the team, the search, and the open forecast. Defaults stay
 * out of the URL: months, by project across projects (no grouping inside one), versions on.
 */

const NAMES = ['zoom', 'group', 'show', 'team', 'q', 'forecast'] as const;

const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

export interface RoadmapViewState extends RoadmapFilters {
  zoom: RoadmapZoom;
  group: RoadmapGroup;
  /** The item whose forecast panel is open. */
  forecast: string | null;
}

export function useRoadmapView(oneProject: boolean) {
  const slice = useSearchSlice(NAMES);
  const fallbackGroup: RoadmapGroup = oneProject ? 'none' : 'project';
  const state = useMemo<RoadmapViewState>(() => {
    const params = new URLSearchParams(slice);
    const show = params.has('show') ? listParam(params.get('show')) : ['versions'];
    return {
      zoom: pick(params.get('zoom'), ROADMAP_ZOOMS, 'months'),
      group: pick(params.get('group'), ROADMAP_GROUPS, fallbackGroup),
      versions: show.includes('versions'),
      done: show.includes('done'),
      teamId: params.get('team'),
      q: params.get('q') ?? '',
      forecast: params.get('forecast'),
    };
  }, [slice, fallbackGroup]);

  const setZoom = useCallback(
    (zoom: RoadmapZoom) => setSearchParams({ zoom: zoom === 'months' ? null : zoom }),
    [],
  );
  const setGroup = useCallback(
    (group: RoadmapGroup) => setSearchParams({ group: group === fallbackGroup ? null : group }),
    [fallbackGroup],
  );
  const setShow = useCallback((versions: boolean, done: boolean) => {
    const show = [versions ? 'versions' : null, done ? 'done' : null].filter(Boolean).join(',');
    setSearchParams({ show: show === 'versions' ? null : show || 'none' });
  }, []);
  const setTeam = useCallback((team: string | null) => setSearchParams({ team }), []);
  const setQuery = useCallback((q: string) => setSearchParams({ q }), []);
  /** Opening a forecast closes the issue peek: the two panels never show together. */
  const openForecast = useCallback((id: string | null) => {
    const open = new URLSearchParams(window.location.search).get('forecast');
    setSearchParams(
      { forecast: id, ...(id ? { issue: null } : {}) },
      { push: id !== null && open === null },
    );
  }, []);
  const clearFilters = useCallback(() => setSearchParams({ q: null, team: null, show: null }), []);
  return { ...state, setZoom, setGroup, setShow, setTeam, setQuery, openForecast, clearFilters };
}

export type RoadmapViewHandle = ReturnType<typeof useRoadmapView>;
