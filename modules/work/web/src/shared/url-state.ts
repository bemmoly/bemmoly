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

let parsed: { search: string; params: URLSearchParams } | null = null;

/** The current parameters, parsed once per address however many components ask. */
function currentParams(): URLSearchParams {
  const search = window.location.search;
  if (parsed?.search !== search) parsed = { search, params: new URLSearchParams(search) };
  return parsed.params;
}

/**
 * One parameter of the current query string, or null. It re-renders only when that parameter
 * changes, so typing in a filter does not redraw everything that reads the open issue.
 */
export function useSearchParam(name: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => currentParams().get(name),
    () => null,
  );
}

/**
 * Whether a parameter holds this value: a list row asks whether it is the open issue, and only
 * the rows that were or become open re-render when another one opens.
 */
export function useSearchParamIs(name: string, value: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => currentParams().get(name) === value,
    () => false,
  );
}

/**
 * Only the named parameters, in a fixed order, as a query string: the part of the address one
 * concern reads, so a change to any other parameter leaves it, and its readers, alone.
 */
export function useSearchSlice(names: readonly string[]): string {
  return useSyncExternalStore(
    subscribe,
    () => {
      const params = currentParams();
      const slice = new URLSearchParams();
      for (const name of names) {
        const value = params.get(name);
        if (value !== null) slice.set(name, value);
      }
      return slice.toString();
    },
    () => '',
  );
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
