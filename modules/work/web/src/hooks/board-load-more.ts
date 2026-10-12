import type { BoardView, BoardViewQuery } from '@bemmoly/module-work/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { create } from 'zustand';
import { api, workKeys } from '../shared/index.ts';
import { mergeColumnPage } from './board-pages.ts';

/*
 * "Load more" for one column: the next page from the column's cursor, appended to the cached
 * view the board shows. A column reads one page at a time; one that failed says so and offers
 * the same button again.
 */

type PageState = 'loading' | 'failed';

interface PagingStore {
  columns: Readonly<Record<string, PageState>>;
  set(column: string, state: PageState | null): void;
}

export const useColumnPaging = create<PagingStore>()((set) => ({
  columns: {},
  set: (column, state) =>
    set((store) => {
      const columns = { ...store.columns };
      if (state) columns[column] = state;
      else delete columns[column];
      return { columns };
    }),
}));

/** Where a column stands: reading its next page, failed to, or neither. */
export function useColumnPageState(columnId: string): PageState | null {
  return useColumnPaging((store) => store.columns[columnId] ?? null);
}

export function useLoadMore(boardId: string, scope: BoardViewQuery) {
  const client = useQueryClient();
  const q = scope.q;
  return useCallback(
    async (columnId: string) => {
      const key = workKeys.boardView(boardId, q ? { q } : {});
      const cursor = client
        .getQueryData<BoardView>(key)
        ?.columns.find((column) => column.id === columnId)?.nextCursor;
      const paging = useColumnPaging.getState();
      if (!cursor || paging.columns[columnId] === 'loading') return;
      paging.set(columnId, 'loading');
      try {
        const page = await api.work.boards.view(boardId, {
          ...(q ? { q } : {}),
          column: columnId,
          cursor,
        });
        client.setQueryData<BoardView>(key, (view) =>
          view ? mergeColumnPage(view, columnId, page) : view,
        );
        paging.set(columnId, null);
      } catch {
        paging.set(columnId, 'failed');
      }
    },
    [client, boardId, q],
  );
}
