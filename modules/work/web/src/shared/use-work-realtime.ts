import { useRealtime, type RealtimeEvent } from '@bemmoly/core-web';
import { queryKeys } from '@bemmoly/api-client';
import { AI_REALTIME_KINDS, type RealtimeScope } from '@bemmoly/shared';
import { WORK_REALTIME_KINDS } from '@bemmoly/module-work/shared';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { createBoardLive } from '../hooks/board-live.ts';
import { realtimeUrl } from './api.ts';
import { workKeys } from './keys.ts';
import { changedBy } from './realtime-scope.ts';

/** How long a burst of events gathers before the reads they touch go once. */
export const REALTIME_GATHER_MS = 150;

const BOARD_FOLLOWS = new Set<string>([WORK_REALTIME_KINDS.issue, WORK_REALTIME_KINDS.board]);

/**
 * The event kinds seen in the last moment, invalidated together: a bulk change of thirty issues
 * sends sixty events, and each list it touches is read once, not sixty times.
 */
export function createGatherer(client: QueryClient) {
  const kinds = new Set<string>();
  // Kinds seen only in events about another project leave this project's board alone.
  const boardKinds = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = () => {
    timer = null;
    const moving = client.isMutating({ mutationKey: workKeys.boardMoves() }) > 0;
    const seen = [...kinds];
    const board = new Set(boardKinds);
    kinds.clear();
    boardKinds.clear();
    void client.invalidateQueries({
      queryKey: workKeys.all(),
      predicate: (query) =>
        seen.some((kind) => {
          // The board follows issue and board events card by card (hooks/board-live.ts).
          if (query.queryKey[1] === 'board-view' && (BOARD_FOLLOWS.has(kind) || !board.has(kind)))
            return false;
          return changedBy(kind, query.queryKey, moving);
        }),
    });
  };
  return {
    add(kind: string, touchesBoard = true) {
      kinds.add(kind);
      if (touchesBoard) boardKinds.add(kind);
      timer ??= setTimeout(run, REALTIME_GATHER_MS);
    },
    dispose() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      kinds.clear();
      boardKinds.clear();
    },
  };
}

/**
 * Subscribes to a project's realtime scope while a Work screen is open. The shell's socket
 * covers workspace events; project events arrive only for subscribed projects, so each screen
 * opens this one for the project it shows. Events carry ids only; the data always comes back
 * through the REST API. An open board patches the cards an event names; every other read the
 * event can have changed is invalidated, once per burst.
 */
export function useWorkRealtime(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const gatherer = useMemo(() => createGatherer(queryClient), [queryClient]);
  const live = useMemo(
    () => (projectId ? createBoardLive(queryClient, projectId) : null),
    [queryClient, projectId],
  );
  useEffect(() => () => gatherer.dispose(), [gatherer]);
  useEffect(() => () => live?.dispose(), [live]);
  const onEvent = useCallback(
    (event: RealtimeEvent) => {
      if (event.kind === AI_REALTIME_KINDS.insight) {
        // A summary, TL;DR, pulse or check about something in this scope was rewritten.
        void queryClient.invalidateQueries({ queryKey: queryKeys.ai.insights() });
        return;
      }
      if (!event.kind.startsWith('work.')) return;
      // Someone is added to or removed from every project they join on their own scope, so a
      // shared member's socket hears about projects this screen does not show.
      const elsewhere =
        event.kind === WORK_REALTIME_KINDS.members &&
        event.projectId !== projectId &&
        !(projectId && event.ids.includes(projectId));
      gatherer.add(event.kind, !elsewhere);
      live?.take(event.kind, event.ids);
    },
    [queryClient, gatherer, live, projectId],
  );
  const scopes: RealtimeScope[] = projectId ? [{ kind: 'project', id: projectId }] : [];
  return useRealtime({ url: realtimeUrl(), scopes, enabled: Boolean(projectId), onEvent });
}
