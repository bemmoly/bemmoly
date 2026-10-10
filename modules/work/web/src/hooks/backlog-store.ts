import { create } from 'zustand';
import type { DropTarget } from '../backlog/move.ts';
import { EMPTY_SELECTION, nextSelection, type Selection } from './issue-selection.ts';

/*
 * The Backlog's client state: selection, the drag in flight and what is
 * collapsed. Filters and the open issue live in the address. Server data never lives here; rows subscribe to the
 * slice they paint so a drag over a thousand rows re-renders two of them.
 */

export interface Drag {
  ids: readonly string[];
  /** pointer: a mouse or touch drag; keyboard: picked up with space. */
  mode: 'pointer' | 'keyboard';
  target: DropTarget | null;
}

interface BacklogUiState {
  projectKey: string | null;
  selection: Selection;
  drag: Drag | null;
  showEpics: boolean;
  collapsed: Readonly<Record<string, boolean>>;
  /** The container whose inline create row is open. */
  creatingIn: string | null;
  reset(projectKey: string): void;
  select(id: string, modifiers: { shift?: boolean; toggle?: boolean }, order: string[]): void;
  setSelection(selection: Selection): void;
  startDrag(ids: readonly string[], mode: Drag['mode'], target: DropTarget | null): void;
  setTarget(target: DropTarget | null): void;
  endDrag(): void;
  toggleEpics(): void;
  toggleCollapsed(containerId: string): void;
  setCreatingIn(containerId: string | null): void;
}

export const useBacklogUi = create<BacklogUiState>()((set) => ({
  projectKey: null,
  selection: EMPTY_SELECTION,
  drag: null,
  showEpics: true,
  collapsed: {},
  creatingIn: null,
  reset: (projectKey) =>
    set((state) =>
      state.projectKey === projectKey
        ? state
        : {
            projectKey,
            selection: EMPTY_SELECTION,
            drag: null,
            collapsed: {},
            creatingIn: null,
          },
    ),
  select: (id, modifiers, order) =>
    set((state) => ({ selection: nextSelection(state.selection, id, modifiers, order) })),
  setSelection: (selection) => set({ selection }),
  startDrag: (ids, mode, target) => set({ drag: { ids, mode, target } }),
  setTarget: (target) =>
    set((state) => {
      if (!state.drag) return state;
      const same =
        state.drag.target?.containerId === target?.containerId &&
        state.drag.target?.beforeId === target?.beforeId;
      return same ? state : { drag: { ...state.drag, target } };
    }),
  endDrag: () => set({ drag: null }),
  toggleEpics: () => set((state) => ({ showEpics: !state.showEpics })),
  toggleCollapsed: (containerId) =>
    set((state) => ({
      collapsed: { ...state.collapsed, [containerId]: !state.collapsed[containerId] },
    })),
  setCreatingIn: (creatingIn) => set({ creatingIn }),
}));
