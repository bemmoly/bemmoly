import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useViewer } from '../hooks/issue-people.ts';

/**
 * Starred projects, per person on this browser. Stars are a personal shortcut (the sidebar
 * lists them first), not shared data, so they are client state; storage that throws or comes
 * back empty leaves every project unstarred and the page still works.
 */
interface StarState {
  byPerson: Record<string, string[]>;
  toggle(personId: string, projectKey: string): void;
}

const useStarStore = create<StarState>()(
  persist(
    (set) => ({
      byPerson: {},
      toggle: (personId, projectKey) =>
        set((state) => {
          const mine = state.byPerson[personId] ?? [];
          const next = mine.includes(projectKey)
            ? mine.filter((key) => key !== projectKey)
            : [...mine, projectKey];
          return { byPerson: { ...state.byPerson, [personId]: next } };
        }),
    }),
    {
      name: 'bemmoly.work.starred-projects',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

const NONE: readonly string[] = [];

/** The signed-in person's starred project keys, and a toggle. */
export function useProjectStars() {
  const viewerId = useViewer()?.id ?? 'anonymous';
  const keys = useStarStore((state) => state.byPerson[viewerId] ?? NONE);
  const toggle = useStarStore((state) => state.toggle);
  return {
    keys,
    isStarred: (projectKey: string) => keys.includes(projectKey),
    toggle: (projectKey: string) => toggle(viewerId, projectKey),
  };
}
