import { useSyncExternalStore } from 'react';

/*
 * Settings › Docs keeps its search, view and open template in the address. The chunk has no
 * router of its own, so it reads and writes the query string and keeps the shell router's
 * history entry state, as Work's screens do.
 */

const CHANGE = 'bemmoly:url';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

/** One parameter of the address, or null; re-renders when it changes. */
export function useSearchParam(name: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
}

interface RouterState {
  __TSR_index?: number;
  [key: string]: unknown;
}

/**
 * Writes parameters; null or empty removes one. A push adds a history entry (opening a
 * template, so Back closes it); otherwise the entry is replaced, so typing never floods it.
 */
export function setSearchParams(
  patch: Readonly<Record<string, string | null>>,
  options: { push?: boolean } = {},
): void {
  const params = new URLSearchParams(window.location.search);
  for (const [name, value] of Object.entries(patch)) {
    if (value === null || value === '') params.delete(name);
    else params.set(name, value);
  }
  const search = params.toString();
  const url = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
  if (url === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
  const state = (window.history.state ?? {}) as RouterState;
  if (options.push) {
    const key = Math.random().toString(36).slice(2, 10);
    window.history.pushState(
      { ...state, key, __TSR_key: key, __TSR_index: (state.__TSR_index ?? 0) + 1 },
      '',
      url,
    );
  } else {
    window.history.replaceState(state, '', url);
  }
  window.dispatchEvent(new Event(CHANGE));
}
