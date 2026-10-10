import { useEffect, useMemo, useRef, type KeyboardEvent, type MouseEvent } from 'react';
import { create } from 'zustand';
import { useBoardDragStore } from './board-drag-store.ts';
import { useBoardLanes } from './board-filters.ts';
import type { BoardModel } from './board-model.ts';
import {
  EMPTY_SELECTION,
  nextSelection,
  pruneSelection,
  type SelectModifiers,
  type Selection,
} from './issue-selection.ts';

/*
 * Multi-select on the Board, with the Backlog's rules (issue-selection.ts) over the cards' keys:
 * the box toggles one, Shift extends from the anchor in screen order, Cmd or Ctrl toggles one,
 * a plain click still opens the peek. Client state only, kept per board so coming back to the
 * board finds the selection as it was left.
 */

interface BoardSelectionState {
  boardId: string | null;
  selection: Selection;
  /** Starts over when another board opens; the same board keeps its selection. */
  reset(boardId: string): void;
  select(key: string, modifiers: SelectModifiers, order: readonly string[]): void;
  setSelection(selection: Selection): void;
  clear(): void;
}

export const useBoardSelectionStore = create<BoardSelectionState>()((set) => ({
  boardId: null,
  selection: EMPTY_SELECTION,
  reset: (boardId) =>
    set((state) => (state.boardId === boardId ? state : { boardId, selection: EMPTY_SELECTION })),
  select: (key, modifiers, order) =>
    set((state) => ({ selection: nextSelection(state.selection, key, modifiers, order) })),
  setSelection: (selection) => set({ selection }),
  clear: () => set({ selection: EMPTY_SELECTION }),
}));

export const clearBoardSelection = () => useBoardSelectionStore.getState().clear();

/** Esc belongs to a carried card until it is dropped or put back. */
export const boardCarrying = () => useBoardDragStore.getState().carrying !== null;

/**
 * The keys a Shift range runs over: the cards as the board draws them, lane by lane and, inside
 * a lane, column by column from the top. A folded lane's cards are out of sight, so a range
 * skips them.
 */
export function selectableOrder(model: BoardModel, collapsed: readonly string[]): string[] {
  return model.lanes
    .filter((lane) => !collapsed.includes(lane.id))
    .flatMap((lane) =>
      model.columns.flatMap((column) => (lane.cells[column.id] ?? []).map((card) => card.key)),
    );
}

/** Every card key the board shows, after filters and pending deletes. */
export function shownKeys(model: BoardModel): Set<string> {
  return new Set(
    model.lanes.flatMap((lane) => Object.values(lane.cells).flatMap((c) => c.map((x) => x.key))),
  );
}

export interface BoardSelectHandlers {
  /** A click on the card: true when Shift or Cmd / Ctrl made it a selection, not an open. */
  click(event: MouseEvent, key: string): boolean;
  /** A click on the card's box: Shift extends the range, otherwise it toggles the card. */
  check(event: MouseEvent, key: string): void;
  /** x toggles the focused card, Shift+x extends to it; true when the key was handled. */
  keyDown(event: KeyboardEvent, key: string): boolean;
  /** What an action on this card applies to: the selection when the card is in it. */
  targets(key: string): string[];
}

/**
 * Keeps the board's selection honest (a filter that hides a card drops it, another board starts
 * empty) and hands the cards stable handlers that read the latest layout.
 */
export function useBoardSelect(model: BoardModel, boardId: string): BoardSelectHandlers {
  const live = useRef(model);
  useEffect(() => {
    live.current = model;
  });
  useEffect(() => useBoardSelectionStore.getState().reset(boardId), [boardId]);
  useEffect(() => {
    const store = useBoardSelectionStore.getState();
    const pruned = pruneSelection(store.selection, shownKeys(model));
    if (pruned !== store.selection) store.setSelection(pruned);
  }, [model]);

  return useMemo(() => {
    const order = () => selectableOrder(live.current, useBoardLanes.getState().collapsed);
    const select = (key: string, modifiers: SelectModifiers) =>
      useBoardSelectionStore.getState().select(key, modifiers, order());
    return {
      click: (event, key) => {
        const toggle = event.metaKey || event.ctrlKey;
        if (toggle || event.shiftKey) {
          select(key, { shift: event.shiftKey, toggle });
          return true;
        }
        // A plain click opens the peek; it also moves the anchor, so Shift-click runs from here.
        const store = useBoardSelectionStore.getState();
        store.setSelection({ ...store.selection, anchor: key });
        return false;
      },
      check: (event, key) => select(key, { shift: event.shiftKey, toggle: !event.shiftKey }),
      keyDown: (event, key) => {
        if (event.key.toLowerCase() !== 'x' || event.metaKey || event.ctrlKey || event.altKey)
          return false;
        event.preventDefault();
        select(key, { shift: event.shiftKey, toggle: !event.shiftKey });
        return true;
      },
      targets: (key) => {
        const ids = useBoardSelectionStore.getState().selection.ids;
        if (!ids.includes(key)) return [key];
        const all = order();
        return [...ids].sort((a, b) => all.indexOf(a) - all.indexOf(b));
      },
    };
  }, []);
}
