import { useCallback, useSyncExternalStore } from 'react';

/**
 * Widths at which the Board keeps its issue panel docked beside it. The mock docks the 400px
 * panel at 1440px beside a 240px project sidebar, leaving the board 800px; below 1200px the
 * docked panel would leave less than that, so the panel overlays the board instead.
 */
export const DOCKED_SLIDE_OVER_QUERY = '(min-width: 1200px)';

const supported = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/** Whether a media query matches now, re-rendering when it starts or stops matching. */
export function useMediaQuery(query: string, fallback = true): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!supported()) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => (supported() ? window.matchMedia(query).matches : fallback),
    () => fallback,
  );
}
