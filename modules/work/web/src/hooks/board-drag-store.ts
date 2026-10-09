import { create } from 'zustand';
import type { ColumnVerdict, DropTarget } from './board-drag.ts';

/*
 * Which card is being carried and where it would land. Client state only: the cards
 * themselves stay in the query cache. Cards and cells subscribe to their own slice, so moving
 * a carried card re-renders the two cells involved, not the board.
 */

export interface CarriedCard {
  issueId: string;
  key: string;
  statusId: string;
  from: DropTarget;
  /** Pointer drags follow the mouse; keyboard drags follow the arrows until space or Escape. */
  mode: 'pointer' | 'keyboard';
}

interface DragState {
  carrying: CarriedCard | null;
  target: DropTarget | null;
  /** Whether each column takes the carried card, once its transitions are known. */
  verdicts: Readonly<Record<string, ColumnVerdict>> | null;
  setVerdicts(verdicts: Readonly<Record<string, ColumnVerdict>> | null): void;
  /** What the screen reader hears about the keyboard drag. */
  announcement: string;
  announce(text: string): void;
  pick(card: CarriedCard): void;
  over(target: DropTarget | null): void;
  /** Ends the drag and hands back what was carried and where it was over. */
  finish(): { carrying: CarriedCard; target: DropTarget | null } | null;
}

const sameTarget = (a: DropTarget | null, b: DropTarget | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.laneId === b.laneId &&
    a.columnId === b.columnId &&
    a.index === b.index);

export const useBoardDragStore = create<DragState>()((set, get) => ({
  carrying: null,
  target: null,
  verdicts: null,
  setVerdicts: (verdicts) => set({ verdicts }),
  announcement: '',
  announce: (announcement) => set({ announcement }),
  pick: (card) => set({ carrying: card, target: card.from, verdicts: null }),
  over: (target) => {
    if (!sameTarget(get().target, target)) set({ target });
  },
  finish: () => {
    const { carrying, target } = get();
    set({ carrying: null, target: null, verdicts: null });
    return carrying ? { carrying, target } : null;
  },
}));
