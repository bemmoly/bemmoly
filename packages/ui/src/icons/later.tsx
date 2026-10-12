import type { LucideIcon, LucideProps } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';

/*
 * The icons the shell does not draw on its first paint (kit-more.tsx, editor-icons.tsx) load as
 * one chunk after it: the app asks for them once it is idle, and a module screen waits for them
 * with its own chunk. An icon asked for before they arrive holds its box, empty, so nothing
 * moves when it fills in.
 */

let drawings: Readonly<Record<string, LucideIcon>> | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function loadLaterIcons(): Promise<void> {
  loading ??= import('./later-icons.ts').then(
    (module) => {
      drawings = module.LATER_ICONS;
      for (const listener of listeners) listener();
    },
    (error: unknown) => {
      // A chunk that failed to load (a deploy replaced it, the network dropped) is asked for
      // again by the next icon that needs it.
      loading = null;
      throw error;
    },
  );
  return loading;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const isLoaded = () => drawings !== null;

/** The drawing once the later icons are in, and the request for them while they are not. */
export function useLaterDrawing(name: string, needed: boolean): LucideIcon | undefined {
  const loaded = useSyncExternalStore(subscribe, isLoaded, isLoaded);
  useEffect(() => {
    if (needed && !loaded) loadLaterIcons().catch(() => undefined);
  }, [needed, loaded]);
  return needed && loaded ? drawings?.[name] : undefined;
}

/** An empty box the size of the drawing it stands in for. */
export function IconBox(props: LucideProps) {
  const { size = 24, className, role } = props;
  return (
    <svg
      role={role}
      aria-label={props['aria-label']}
      aria-hidden={props['aria-hidden']}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={className}
    />
  );
}
