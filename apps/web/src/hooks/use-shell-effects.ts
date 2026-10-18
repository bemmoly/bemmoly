import { keysForEvent, queryKeys } from '@bemmoly/api-client';
import type { RealtimeScope } from '@bemmoly/shared';
import { useRealtime, type RealtimeEvent } from '@bemmoly/core-web';
import { useQueryClient, type Query } from '@tanstack/react-query';
import { useCallback } from 'react';
import { realtimeUrl } from '../lib/api.ts';

/** Workspace-wide changes, plus anything addressed to this person (the hub delivers those unasked). */
const WORKSPACE: RealtimeScope[] = [{ kind: 'workspace' }];

/*
 * An open board follows its own events card by card on the Work screen's socket, which the hub
 * also hands every event addressed to this person. Reading the whole board again here as well
 * would undo that: this person joining some other project would cost the board a full
 * read. A board no screen shows is only marked stale, as every other read is.
 */
export const isShownBoard = (query: Query) =>
  query.queryKey[0] === queryKeys.work()[0] &&
  query.queryKey[1] === 'board-view' &&
  query.getObserversCount() > 0;

/** One socket per tab for the signed-in person; events invalidate the matching queries. */
export function useRealtimeSync(enabled: boolean) {
  const queryClient = useQueryClient();
  const onEvent = useCallback(
    (event: RealtimeEvent) => {
      for (const queryKey of keysForEvent(event.kind))
        void queryClient.invalidateQueries({
          queryKey,
          predicate: (query) => !isShownBoard(query),
        });
    },
    [queryClient],
  );
  return useRealtime({ url: realtimeUrl(), scopes: WORKSPACE, enabled, onEvent });
}
