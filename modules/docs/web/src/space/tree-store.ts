import { readPreference, usePreference, writePreference } from '@bemmoly/core-web';
import { create } from 'zustand';

/*
 * Which pages are open in each space's sidebar tree, and which space has the sidebar to itself
 * (focus mode). Client state, so it lives here rather than in the query cache. It is a
 * preference of the signed-in person on this device, kept by the shell's person store, so a
 * reload keeps the tree as it was and two people sharing a browser keep their own.
 */

const OPEN_KEY = 'docs.tree-open';
const FOCUS_KEY = 'docs.tree-focus';

type OpenBySpace = Record<string, readonly string[]>;

const readOpen = () => readPreference<OpenBySpace>(OPEN_KEY, {});

function writeOpen(spaceKey: string, change: (ids: Set<string>) => boolean): void {
  const all = readOpen();
  const ids = new Set(all[spaceKey] ?? []);
  if (!change(ids)) return;
  writePreference<OpenBySpace>(OPEN_KEY, { ...all, [spaceKey]: [...ids] });
}

interface TreeOpenState {
  /** Opens or closes one page. */
  set: (spaceKey: string, pageId: string, open: boolean) => void;
  /** Opens every page on the way to the one shown, keeping the rest. */
  reveal: (spaceKey: string, pageIds: readonly string[]) => void;
}

/** The tree's open-state actions; the state itself is read with useOpenIds. */
export const useTreeOpen = create<TreeOpenState>(() => ({
  set: (spaceKey, pageId, open) =>
    writeOpen(spaceKey, (ids) => {
      if (open === ids.has(pageId)) return false;
      if (open) ids.add(pageId);
      else ids.delete(pageId);
      return true;
    }),
  reveal: (spaceKey, pageIds) =>
    writeOpen(spaceKey, (ids) => {
      if (pageIds.every((id) => ids.has(id))) return false;
      for (const id of pageIds) ids.add(id);
      return true;
    }),
}));

const NONE: readonly string[] = [];

/** The open pages of one space, as a stable array. */
export function useOpenIds(spaceKey: string): readonly string[] {
  const [open] = usePreference<OpenBySpace>(OPEN_KEY, {});
  return open[spaceKey] ?? NONE;
}

/**
 * The space that has the sidebar to itself, with a filter, or null for all of Docs. Kept per
 * person, so a writer who lives in one big space finds it focused again tomorrow.
 */
export function useTreeFocus(): [string | null, (spaceKey: string | null) => void] {
  return usePreference<string | null>(FOCUS_KEY, null);
}
