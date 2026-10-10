import { useSyncExternalStore } from 'react';

/*
 * The parts of a screen's state that belong in the address: filters, grouping, the open issue.
 * The chunk has no router of its own, so it reads and writes the query string directly and
 * keeps the shell router's history entry state intact, the way navigateTo does.
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

const snapshot = () => window.location.search;

/** The current query string; re-renders when a screen writes it or back and forward move. */
export function useSearch(): string {
  return useSyncExternalStore(subscribe, snapshot, () => '');
}

/** One parameter of the current query string, or null. */
export function useSearchParam(name: string): string | null {
  return new URLSearchParams(useSearch()).get(name);
}

interface RouterState {
  __TSR_index?: number;
  [key: string]: unknown;
}

export type ParamPatch = Readonly<Record<string, string | null | undefined>>;

/**
 * Writes parameters into the address; null or an empty string removes one. A push adds a
 * history entry (opening an issue, so Back closes it); otherwise the entry is replaced, so
 * typing in the filter box never floods history.
 */
export function setSearchParams(patch: ParamPatch, options: { push?: boolean } = {}): void {
  const params = new URLSearchParams(window.location.search);
  for (const [name, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === '') params.delete(name);
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

/** A list parameter: "a,b,c". */
export const listParam = (value: string | null): string[] =>
  value ? value.split(',').filter(Boolean) : [];

export const joinParam = (list: readonly string[]): string | null =>
  list.length > 0 ? list.join(',') : null;
