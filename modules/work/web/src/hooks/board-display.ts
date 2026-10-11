import type { CardField } from '@bemmoly/module-work/shared';
import { useCallback, useMemo } from 'react';
import { z } from 'zod';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { safeJSONStorage } from '../shared/safe-storage.ts';
import type { ColumnModel } from './board-model.ts';

/*
 * How cards look is the board's, set by project and org admins in Board settings › Cards, and
 * the same for everyone on the project: a card draws exactly the board's card fields. The only
 * personal display choice left is whether empty columns take room, kept in this browser per
 * person and board. Views stored before cards became the board's alone carried card fields and
 * a density; those keys are dropped on read and never reach a card.
 */

const displaySchema = z.object({ showEmptyColumns: z.boolean() });

export type BoardDisplay = z.infer<typeof displaySchema>;

export const DEFAULT_DISPLAY: BoardDisplay = { showEmptyColumns: true };

/** The fields every card shows: exactly the board's card fields, nothing added. */
export function shownFields(boardFields: readonly CardField[]): ReadonlySet<CardField> {
  return new Set(boardFields);
}

export function isCustomized(display: BoardDisplay): boolean {
  return display.showEmptyColumns !== DEFAULT_DISPLAY.showEmptyColumns;
}

/**
 * The columns the board draws. Hidden empty columns come back while a card is carried, so it
 * can still be dropped there, and when every column is empty, so the headings stay.
 */
export function visibleColumns<C extends Pick<ColumnModel, 'count'>>(
  columns: readonly C[],
  showEmpty: boolean,
  carrying: boolean,
): readonly C[] {
  if (showEmpty || carrying) return columns;
  const filled = columns.filter((column) => column.count > 0);
  return filled.length > 0 ? filled : columns;
}

interface DisplayState {
  views: Readonly<Record<string, BoardDisplay>>;
  update(view: string, change: (display: BoardDisplay) => BoardDisplay): void;
  reset(view: string): void;
}

export const useBoardDisplayStore = create<DisplayState>()(
  persist(
    (set) => ({
      views: {},
      update: (view, change) =>
        set((state) => ({
          views: { ...state.views, [view]: change(state.views[view] ?? DEFAULT_DISPLAY) },
        })),
      reset: (view) =>
        set((state) => ({
          views: Object.fromEntries(Object.entries(state.views).filter(([key]) => key !== view)),
        })),
    }),
    {
      name: 'bemmoly.work.board-display',
      version: 2,
      storage: safeJSONStorage(),
      partialize: (state) => ({ views: state.views }),
      // Version 1 views keep their empty-column choice; merge drops the rest.
      migrate: (persisted) => persisted as { views: Record<string, BoardDisplay> },
      // Whatever storage hands back is checked and narrowed to the personal choice; card
      // fields and density from older versions are not carried over.
      merge: (persisted, current) => {
        const raw = (persisted as { views?: unknown } | undefined)?.views;
        const views: Record<string, BoardDisplay> = {};
        if (raw && typeof raw === 'object') {
          for (const [view, value] of Object.entries(raw)) {
            const parsed = displaySchema.safeParse(value);
            if (parsed.success && isCustomized(parsed.data)) views[view] = parsed.data;
          }
        }
        return { ...current, views };
      },
    },
  ),
);

/** One person's view of one board: the board's card fields and their empty-column choice. */
export function useBoardDisplay(
  boardId: string,
  personId: string | undefined,
  boardFields: readonly CardField[],
) {
  const view = `${personId ?? 'anonymous'}:${boardId}`;
  const stored = useBoardDisplayStore((state) => state.views[view]);
  const display = stored ?? DEFAULT_DISPLAY;
  const update = useBoardDisplayStore((state) => state.update);
  const resetView = useBoardDisplayStore((state) => state.reset);

  const setShowEmptyColumns = useCallback(
    (showEmptyColumns: boolean) => update(view, () => ({ showEmptyColumns })),
    [update, view],
  );
  const reset = useCallback(() => resetView(view), [resetView, view]);
  const shown = useMemo(() => shownFields(boardFields), [boardFields]);

  return { display, shown, customized: isCustomized(display), setShowEmptyColumns, reset };
}

export type BoardDisplayApi = ReturnType<typeof useBoardDisplay>;
