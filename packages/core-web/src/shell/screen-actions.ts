import { useEffect, useId, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { RecentLook } from './recents.ts';

/**
 * What the screen on show can do, offered first in ⌘K's empty state ("Assign PLT-204 to me",
 * "Go to backlog") and listed by the shortcuts overlay. A screen registers its actions while
 * it is mounted; the palette reads whatever is registered when it opens.
 */
export interface ScreenAction {
  id: string;
  title: string;
  look?: RecentLook;
  /** The shortcut that does the same, drawn by Kbd: "C", "G B". */
  keys?: string;
  keywords?: readonly string[];
  run: () => void;
}

/** A group of shortcuts the "?" overlay lists while a screen shows them. */
export interface ShortcutGroup {
  id: string;
  label: string;
  keys: readonly { keys: string; label: string }[];
}

interface Registry<T> {
  entries: Map<string, T[]>;
  listeners: Set<() => void>;
  version: number;
  snapshot: T[];
}

function registry<T>(): Registry<T> {
  return { entries: new Map(), listeners: new Set(), version: 0, snapshot: [] };
}

const actions = registry<ScreenAction>();
const shortcuts = registry<ShortcutGroup>();

function publish<T>(store: Registry<T>) {
  store.version += 1;
  store.snapshot = [...store.entries.values()].flat();
  for (const listener of store.listeners) listener();
}

function useRegister<T extends { id: string }>(store: Registry<T>, list: readonly T[] | null) {
  const owner = useId();
  const latest = useRef(list);
  useLayoutEffect(() => {
    latest.current = list;
  });
  const signature = signatureOf(list);
  useEffect(() => {
    if (!latest.current) return undefined;
    store.entries.set(owner, [...latest.current]);
    publish(store);
    return () => {
      store.entries.delete(owner);
      publish(store);
    };
  }, [store, owner, signature]);
}

const signatureOf = (list: readonly { id: string }[] | null) =>
  list ? JSON.stringify(list.map((entry) => [entry.id, entry])) : '';

function useSnapshot<T>(store: Registry<T>): T[] {
  return useSyncExternalStore(
    (listener) => {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    () => store.snapshot,
    () => store.snapshot,
  );
}

/**
 * Offers these actions while the calling screen is mounted; null offers nothing yet. Handlers
 * change on every render, so the registered actions call the newest ones by id.
 */
export function useScreenActions(list: readonly ScreenAction[] | null): void {
  const latest = useRef(list);
  useLayoutEffect(() => {
    latest.current = list;
  });
  const signature = signatureOf(list);
  // Rebuilt from the signature (the list without its handlers), so a new handler alone keeps
  // the registered actions as they are.
  const stable = useMemo(
    () =>
      signature
        ? (JSON.parse(signature) as [string, ScreenAction][]).map(([id, entry]) => ({
            ...entry,
            run: () => latest.current?.find((next) => next.id === id)?.run(),
          }))
        : null,
    [signature],
  );
  useRegister(actions, stable);
}

/** Every action the mounted screens offer, in mount order. */
export function useCurrentScreenActions(): ScreenAction[] {
  return useSnapshot(actions);
}

/** The calling screen's own shortcuts, listed in the "?" overlay while it is mounted. */
export function useShortcutHelp(group: ShortcutGroup | null): void {
  useRegister(shortcuts, group ? [group] : null);
}

export function useShortcutGroups(): ShortcutGroup[] {
  return useSnapshot(shortcuts);
}
