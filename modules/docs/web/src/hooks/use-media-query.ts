import { useSyncExternalStore } from 'react';

const listFor = (query: string) =>
  typeof window === 'undefined' ? null : window.matchMedia?.(query);

/** True while the media query matches, following resizes; false where there is no window. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = listFor(query);
      list?.addEventListener('change', onChange);
      return () => list?.removeEventListener('change', onChange);
    },
    () => Boolean(listFor(query)?.matches),
    () => false,
  );
}
