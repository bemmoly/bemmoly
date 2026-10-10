import { create } from 'zustand';

interface FreshPages {
  /** Pages made in place this session that nobody has written in yet. */
  ids: ReadonlySet<string>;
  add: (id: string) => void;
  remove: (id: string) => void;
}

/**
 * A page created in place opens with the caret in its title and templates in its body; once
 * it has a title or a word it is an ordinary page. Kept per tab: a reload opens it plainly.
 */
export const useFreshPages = create<FreshPages>((set, get) => ({
  ids: new Set(),
  add: (id) => set({ ids: new Set(get().ids).add(id) }),
  remove: (id) => {
    if (!get().ids.has(id)) return;
    const next = new Set(get().ids);
    next.delete(id);
    set({ ids: next });
  },
}));
