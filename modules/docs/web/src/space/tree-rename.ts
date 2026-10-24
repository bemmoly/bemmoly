import { create } from 'zustand';

interface TreeRename {
  /** The row whose title is a field now, or null. */
  id: string | null;
  start: (id: string) => void;
  stop: () => void;
}

/**
 * Which tree row is being renamed. Shared, so a folder made from a menu outside the tree
 * opens with its name ready to type, as a new folder does in a file manager.
 */
export const useTreeRename = create<TreeRename>((set) => ({
  id: null,
  start: (id) => set({ id }),
  stop: () => set({ id: null }),
}));
