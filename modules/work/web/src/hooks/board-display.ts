import type { CardField } from '@bemmoly/module-work/shared';
import { useCallback, useMemo } from 'react';
import { z } from 'zod';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { safeJSONStorage } from '../shared/safe-storage.ts';
import type { ColumnModel } from './board-model.ts';

/*
 * How one person likes to see one board: which fields the cards show, how dense they sit, and
 * whether empty columns take room. A personal view, so it lives in this browser per person and
 * board, never in the board's settings (which the project shares). Untouched, everything is the
 * board as its settings draw it; a field set back to the board's own choice follows the board
 * again, so an admin's later change still reaches it.
 */

/** The card fields a person can turn on or off, in the menu's order. */
export const DISPLAY_FIELDS = [
  'key',
  'priority',
  'estimate',
  'age',
  'assignee',
  'labels',
  'blocked',
  'docs',
  'subtasks',
] as const;

export type DisplayField = (typeof DISPLAY_FIELDS)[number];
export type Density = 'comfortable' | 'compact';

const displaySchema = z.object({
  fields: z.partialRecord(z.enum(DISPLAY_FIELDS), z.boolean()),
  density: z.enum(['comfortable', 'compact']),
  showEmptyColumns: z.boolean(),
});

export type BoardDisplay = z.infer<typeof displaySchema>;

export const DEFAULT_DISPLAY: BoardDisplay = {
  fields: {},
  density: 'comfortable',
  showEmptyColumns: true,
};

/** Drawn on every card whatever the board's settings say, until a person hides them. */
const ALWAYS: ReadonlySet<DisplayField> = new Set(['key', 'priority', 'age']);

/** What the board itself shows for a field, before any personal choice. */
export function boardDefault(field: DisplayField, boardFields: readonly CardField[]): boolean {
  return ALWAYS.has(field) || (boardFields as readonly string[]).includes(field);
}

/** The fields this person's cards show on this board. */
export function shownFields(
  display: BoardDisplay,
  boardFields: readonly CardField[],
): ReadonlySet<DisplayField> {
  return new Set(
    DISPLAY_FIELDS.filter((field) => display.fields[field] ?? boardDefault(field, boardFields)),
  );
}

export function isCustomized(display: BoardDisplay): boolean {
  return (
    Object.keys(display.fields).length > 0 ||
    display.density !== DEFAULT_DISPLAY.density ||
    display.showEmptyColumns !== DEFAULT_DISPLAY.showEmptyColumns
  );
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

/** A copy of the record without one key. */
const without = <R extends Readonly<Record<string, unknown>>>(record: R, key: string): R =>
  Object.fromEntries(Object.entries(record).filter(([entry]) => entry !== key)) as R;

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
      reset: (view) => set((state) => ({ views: without(state.views, view) })),
    }),
    {
      name: 'bemmoly.work.board-display',
      version: 1,
      storage: safeJSONStorage(),
      partialize: (state) => ({ views: state.views }),
      // Whatever storage hands back is checked; a view it cannot read falls back to the board.
      merge: (persisted, current) => {
        const raw = (persisted as { views?: unknown } | undefined)?.views;
        const views: Record<string, BoardDisplay> = {};
        if (raw && typeof raw === 'object') {
          for (const [view, value] of Object.entries(raw)) {
            const parsed = displaySchema.safeParse(value);
            if (parsed.success) views[view] = parsed.data;
          }
        }
        return { ...current, views };
      },
    },
  ),
);

/** One person's view of one board, and the ways to change it. */
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

  const setField = useCallback(
    (field: DisplayField, on: boolean) =>
      update(view, (current) => {
        const fields = without(current.fields, field);
        return {
          ...current,
          fields: on === boardDefault(field, boardFields) ? fields : { ...fields, [field]: on },
        };
      }),
    [update, view, boardFields],
  );
  const setDensity = useCallback(
    (density: Density) => update(view, (current) => ({ ...current, density })),
    [update, view],
  );
  const setShowEmptyColumns = useCallback(
    (showEmptyColumns: boolean) => update(view, (current) => ({ ...current, showEmptyColumns })),
    [update, view],
  );
  const reset = useCallback(() => resetView(view), [resetView, view]);
  const shown = useMemo(() => shownFields(display, boardFields), [display, boardFields]);

  return {
    display,
    shown,
    customized: isCustomized(display),
    setField,
    setDensity,
    setShowEmptyColumns,
    reset,
  };
}

export type BoardDisplayApi = ReturnType<typeof useBoardDisplay>;
