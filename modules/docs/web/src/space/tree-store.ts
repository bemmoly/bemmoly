import { create } from 'zustand';

/*
 * Which pages are open in each space's sidebar tree. Client state, so it
 * lives here rather than in the query cache; it is remembered per browser so
 * a reload keeps the tree as it was. Storage can be missing or throw (private
 * windows, blocked site data), and the tree then simply starts closed.
 */

const STORAGE_KEY = 'bemmoly.docs.tree-open';

type OpenBySpace = Record<string, readonly string[]>;

function load(): OpenBySpace {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as OpenBySpace) : {};
  } catch {
    return {};
  }
}

function save(open: OpenBySpace): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(open));
  } catch {
    // Nowhere to remember it; the tree still works for this visit.
  }
}

interface TreeOpenState {
  open: OpenBySpace;
  /** Opens or closes one page. */
  set: (spaceKey: string, pageId: string, open: boolean) => void;
  /** Opens every page on the way to the one shown, keeping the rest. */
  reveal: (spaceKey: string, pageIds: readonly string[]) => void;
}

export const useTreeOpen = create<TreeOpenState>((set) => ({
  open: typeof window === 'undefined' ? {} : load(),
  set: (spaceKey, pageId, isOpen) =>
    set((state) => {
      const ids = new Set(state.open[spaceKey] ?? []);
      if (isOpen) ids.add(pageId);
      else ids.delete(pageId);
      const open = { ...state.open, [spaceKey]: [...ids] };
      save(open);
      return { open };
    }),
  reveal: (spaceKey, pageIds) =>
    set((state) => {
      const ids = new Set(state.open[spaceKey] ?? []);
      if (pageIds.every((id) => ids.has(id))) return state;
      for (const id of pageIds) ids.add(id);
      const open = { ...state.open, [spaceKey]: [...ids] };
      save(open);
      return { open };
    }),
}));

const NONE: readonly string[] = [];

/** The open pages of one space, as a stable array. */
export const useOpenIds = (spaceKey: string) =>
  useTreeOpen((state) => state.open[spaceKey] ?? NONE);
