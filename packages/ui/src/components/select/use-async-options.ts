import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { LoadOptions, SelectOption } from './types.ts';

/** Typing pauses this long before the server is asked. */
export const SEARCH_DEBOUNCE_MS = 200;

interface Result {
  query: string;
  options: readonly SelectOption[];
  failed: boolean;
}

export interface AsyncOptions {
  /** The server's answer for the current query, or null when none applies yet. */
  options: readonly SelectOption[] | null;
  loading: boolean;
  failed: boolean;
}

/**
 * Asks `load` for the options matching `query` while the list is open, 200ms after the last
 * keystroke. A newer query aborts the older request, so results never arrive out of order.
 * `enabled` is false when the caller's own options already answer the query (an empty query
 * over a preloaded list).
 */
export function useAsyncOptions(
  load: LoadOptions | undefined,
  query: string,
  enabled: boolean,
): AsyncOptions {
  const [result, setResult] = useState<Result | null>(null);
  const loadRef = useRef(load);
  useLayoutEffect(() => {
    loadRef.current = load;
  });
  const active = Boolean(load) && enabled;

  useEffect(() => {
    if (!active) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const run = loadRef.current;
      if (!run) return;
      run(query, controller.signal).then(
        (options) => {
          if (!controller.signal.aborted) setResult({ query, options, failed: false });
        },
        () => {
          if (!controller.signal.aborted) setResult({ query, options: [], failed: true });
        },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, query]);

  if (!active) return { options: null, loading: false, failed: false };
  const current = result?.query === query ? result : null;
  return {
    options: current?.options ?? result?.options ?? null,
    loading: !current,
    failed: current?.failed ?? false,
  };
}
