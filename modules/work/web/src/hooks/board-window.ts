import { create } from 'zustand';

/*
 * Long columns render in windows: the first CELL_WINDOW cards, then another window each time
 * the end of the cell scrolls into view or the keyboard walks past it. A 500-card board then
 * mounts a few hundred cards, and the rest cost nothing until someone looks at them.
 */

export const CELL_WINDOW = 60;

interface WindowState {
  limits: Readonly<Record<string, number>>;
  /** Makes sure the card at `index` of a cell is rendered. */
  reveal(cell: string, index: number): void;
  grow(cell: string): void;
}

export const cellId = (laneId: string, columnId: string) => `${laneId}:${columnId}`;

export const useBoardWindowStore = create<WindowState>()((set, get) => ({
  limits: {},
  reveal: (cell, index) => {
    const limit = get().limits[cell] ?? CELL_WINDOW;
    if (index < limit) return;
    set({ limits: { ...get().limits, [cell]: index + CELL_WINDOW } });
  },
  grow: (cell) => {
    const limit = get().limits[cell] ?? CELL_WINDOW;
    set({ limits: { ...get().limits, [cell]: limit + CELL_WINDOW } });
  },
}));

/** How many cards of a cell are rendered. */
export function useCellLimit(cell: string): number {
  return useBoardWindowStore((state) => state.limits[cell] ?? CELL_WINDOW);
}
