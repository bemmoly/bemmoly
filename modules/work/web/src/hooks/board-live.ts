import {
  BOARD_PATCH_MAX,
  WORK_REALTIME_KINDS,
  type BoardView,
  type BoardViewQuery,
} from '@bemmoly/module-work/shared';
import type { Query, QueryClient, QueryKey } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';
import { applyCardPatch } from './board-pages.ts';

/*
 * A board on screen follows its project's realtime events card by card. An issue event names
 * the issues that changed: after a short pause that gathers a burst into one read, the board
 * asks the server for those cards alone and patches them into each cached view (moved,
 * changed, added, gone), with every column's count. A change only a full read can show (a
 * board's config, a sprint starting or ending, a burst too large to name) reads the views
 * again instead, as does a patch that fails or no longer fits the view.
 */

export const BOARD_PATCH_DELAY = 150;

export interface BoardLive {
  /** One realtime event; anything but an issue or board event is not the board's to follow. */
  take(kind: string, ids: readonly string[]): void;
  dispose(): void;
}

const isViewOf = (projectId: string) => (query: Query) =>
  (query.state.data as BoardView | undefined)?.board.projectId === projectId;

export function createBoardLive(
  client: QueryClient,
  projectId: string,
  delay = BOARD_PATCH_DELAY,
): BoardLive {
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const views = () =>
    client
      .getQueriesData<BoardView>({ queryKey: workKeys.boardViews() })
      .filter((entry): entry is [QueryKey, BoardView] => entry[1]?.board.projectId === projectId);
  // A view read while cards are being moved would lack the moves still in flight and put
  // their cards back; the last move to settle reads the board again.
  const moving = () => client.isMutating({ mutationKey: workKeys.boardMoves() }) > 0;
  const readAgain = (queryKey: QueryKey = workKeys.boardViews(), exact = false) => {
    if (moving()) return;
    void client.invalidateQueries({ queryKey, exact, predicate: isViewOf(projectId) });
  };

  async function patch(key: QueryKey, view: BoardView, ids: string[]): Promise<void> {
    const scope = (key.at(-1) ?? {}) as BoardViewQuery;
    try {
      const answer = await api.work.boards.view(view.board.id, {
        ...(scope.q ? { q: scope.q } : {}),
        ...(scope.sprintId ? { sprintId: scope.sprintId } : {}),
        issueIds: ids.join(','),
      });
      if (disposed || moving()) return;
      let fits = true;
      client.setQueryData<BoardView>(key, (now) => {
        if (!now) return now;
        const next = applyCardPatch(now, answer, ids);
        fits = next !== null;
        return next ?? now;
      });
      if (!fits) readAgain(key, true);
    } catch {
      if (!disposed) readAgain(key, true);
    }
  }

  async function flush(): Promise<void> {
    if (disposed || pending.size === 0) return;
    if (moving()) {
      pending.clear();
      return;
    }
    // A read in flight may predate these changes; patch once it has landed.
    if (client.isFetching({ queryKey: workKeys.boardViews() }) > 0) {
      schedule();
      return;
    }
    const ids = [...pending];
    pending.clear();
    if (ids.length > BOARD_PATCH_MAX) {
      readAgain();
      return;
    }
    await Promise.all(
      views().map(([key, view]) => {
        // A view no screen shows is only marked stale: it is read when a board opens again.
        const watched =
          (client.getQueryCache().find({ queryKey: key, exact: true })?.getObserversCount() ?? 0) >
          0;
        if (watched) return patch(key, view, ids);
        void client.invalidateQueries({ queryKey: key, exact: true, refetchType: 'none' });
        return undefined;
      }),
    );
  }

  function schedule(): void {
    if (timer !== null || disposed) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, delay);
  }

  return {
    take(kind, ids) {
      if (disposed) return;
      if (kind !== WORK_REALTIME_KINDS.issue && kind !== WORK_REALTIME_KINDS.board) return;
      // Board events name boards (a config change, a sprint starting or ending) or the
      // project (a scheme change) when they are not about issues.
      const whole = new Set([projectId, ...views().map(([, view]) => view.board.id)]);
      if (
        kind === WORK_REALTIME_KINDS.board &&
        (ids.length === 0 || ids.some((id) => whole.has(id)))
      ) {
        pending.clear();
        void client.invalidateQueries({ queryKey: workKeys.boards(projectId) });
        readAgain();
        return;
      }
      for (const id of ids) pending.add(id);
      schedule();
    },
    dispose() {
      disposed = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending.clear();
    },
  };
}
