import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-color-scheme: dark)';

const media = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY)
    : null;

function subscribe(onChange: () => void): () => void {
  const list = media();
  list?.addEventListener('change', onChange);
  return () => list?.removeEventListener('change', onChange);
}

/** Whether the device prefers dark right now; follows the OS setting live (Match system). */
export function useSystemDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => media()?.matches ?? false,
    () => false,
  );
}
