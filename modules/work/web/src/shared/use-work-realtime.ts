import { useRealtime, type RealtimeEvent } from '@bemmoly/core-web';
import type { RealtimeScope } from '@bemmoly/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { realtimeUrl } from './api.ts';
import { workKeys } from './keys.ts';

/**
 * Subscribes to a project's realtime scope while a Work screen is open and
 * invalidates the project's queries on every event. The shell's socket covers
 * workspace events; project events arrive only for subscribed projects, so
 * each screen opens this one for the project it shows. Events carry ids only;
 * the data always comes back through the REST API.
 */
export function useWorkRealtime(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const onEvent = useCallback(
    (event: RealtimeEvent) => {
      if (!event.kind.startsWith('work.')) return;
      // While cards are being moved, a board view read now would lack the moves still in
      // flight and put their cards back; the last move to settle reads the board again.
      const moving = queryClient.isMutating({ mutationKey: workKeys.boardMoves() }) > 0;
      void queryClient.invalidateQueries({
        queryKey: workKeys.all(),
        ...(moving ? { predicate: (query) => query.queryKey[1] !== 'board-view' } : {}),
      });
    },
    [queryClient],
  );
  const scopes: RealtimeScope[] = projectId ? [{ kind: 'project', id: projectId }] : [];
  return useRealtime({ url: realtimeUrl(), scopes, enabled: Boolean(projectId), onEvent });
}
