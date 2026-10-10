import { useEffect, useSyncExternalStore } from 'react';

/*
 * One module's section may ask for the whole sidebar for a while (Docs' focus mode on a big
 * space): the shell then draws only that section under the brand block, and puts everything
 * back when it lets go. The last module to ask holds it; letting go is per module, so a
 * section that unmounts never releases another's hold.
 */

let owner: string | null = null;
const listeners = new Set<() => void>();

function set(next: string | null) {
  if (next === owner) return;
  owner = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The module whose section has the sidebar to itself, if any. */
export function useSidebarFocusOwner(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => owner,
    () => null,
  );
}

/** Asks for the whole sidebar while `active`; gives it back when inactive or unmounted. */
export function useSidebarTakeover(moduleId: string, active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    set(moduleId);
    return () => {
      if (owner === moduleId) set(null);
    };
  }, [moduleId, active]);
}
