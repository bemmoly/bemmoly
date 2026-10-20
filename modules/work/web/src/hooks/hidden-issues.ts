import { create } from 'zustand';

interface Hidden {
  keys: ReadonlySet<string>;
  hide(keys: readonly string[]): void;
  show(keys: readonly string[]): void;
}

/**
 * Issues on their way off a list: deleted but inside their Undo window, or archived while the
 * request is out. List screens leave them out.
 */
export const useHiddenIssues = create<Hidden>()((set) => ({
  keys: new Set(),
  hide: (keys) => set((state) => ({ keys: new Set([...state.keys, ...keys]) })),
  show: (keys) =>
    set((state) => ({ keys: new Set([...state.keys].filter((key) => !keys.includes(key))) })),
}));
