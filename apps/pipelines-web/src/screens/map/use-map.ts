import { topicOf, type MapQuery } from '@bemmoly/module-pipelines/shared';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';
import { deliveryKeys } from '../../api/delivery.ts';
import { useScope } from '../../hooks/use-scope.ts';
import { useStream } from '../../hooks/use-stream.ts';
import { api } from '../../lib/api.ts';

type Search = Record<string, unknown>;

export interface MapState {
  scope: string;
  /** An ISO time while rewound; null is live. */
  at: string | null;
  team: string | null;
  tier: number | null;
  /** Domains opened in place, as the drawing shows Commerce with its groups. */
  open: readonly string[];
}

/** The map's state from the address, and one writer for every part of it. */
export function useMapState() {
  const search = useSearch({ strict: false }) as Search;
  const navigate = useNavigate();
  const { path } = useScope();
  const tier = Number(search['tier']);
  const state: MapState = {
    scope: path,
    at:
      typeof search['at'] === 'string' && !Number.isNaN(Date.parse(search['at']))
        ? search['at']
        : null,
    team: typeof search['team'] === 'string' ? search['team'] : null,
    tier: search['tier'] !== undefined && [0, 1, 2].includes(tier) ? tier : null,
    open: typeof search['open'] === 'string' ? search['open'].split(',').filter(Boolean) : [],
  };
  const set = useCallback(
    (
      next: Partial<Record<'scope' | 'at' | 'team' | 'tier' | 'open', string | undefined>>,
      replace = false,
    ) =>
      void navigate({ to: '.', search: (previous: Search) => ({ ...previous, ...next }), replace }),
    [navigate],
  );
  return { state, set };
}

/**
 * One map for a scope, as of a moment or live. Live maps listen on their scope's topic; an
 * event names cells that changed and the map is read again (the server coalesces to one a
 * second), so a busy hour never queues renders.
 */
export function useReleaseMap(state: MapState, scope = state.scope, enabled = true) {
  const client = useQueryClient();
  const query: MapQuery = {
    ...(scope ? { scope } : {}),
    ...(state.at ? { at: state.at } : {}),
    ...(state.team ? { team: state.team } : {}),
    ...(state.tier !== null ? { tier: state.tier } : {}),
  };
  const key = deliveryKeys.map(query);
  const map = useQuery({
    queryKey: key,
    queryFn: () => api.delivery.map(query),
    placeholderData: keepPreviousData,
    enabled,
    // Rewound maps are history: they do not change.
    staleTime: state.at ? Infinity : 30_000,
  });
  useStream(enabled && !state.at ? [topicOf.map(scope)] : [], () => {
    void client.invalidateQueries({ queryKey: key, exact: true });
  });
  return map;
}
