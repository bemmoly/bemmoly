import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import { workKeys } from '../shared/keys.ts';

/*
 * Which issues have an edit on its way, read by every card and row of a list screen. One
 * listener on the mutation cache keeps the set for the whole screen and tells the cards only
 * when it changes, so a 500-card board does not scan the cache once per card on every mutation
 * event, a card move among them.
 */

interface PendingEdits {
  keys: ReadonlySet<string>;
  subscribe(onChange: () => void): () => void;
}

const PREFIX = workKeys.issueEdits();
const stores = new WeakMap<QueryClient, PendingEdits>();

function pendingKeys(client: QueryClient): Set<string> {
  const keys = new Set<string>();
  for (const mutation of client.getMutationCache().getAll()) {
    if (mutation.state.status !== 'pending') continue;
    const key = mutation.options.mutationKey;
    if (!key || key.length <= PREFIX.length) continue;
    if (PREFIX.every((part, index) => key[index] === part)) keys.add(String(key[PREFIX.length]));
  }
  return keys;
}

const same = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((key) => b.has(key));

function storeFor(client: QueryClient): PendingEdits {
  const known = stores.get(client);
  if (known) return known;
  const listeners = new Set<() => void>();
  let stop: (() => void) | null = null;
  const store: PendingEdits = {
    keys: pendingKeys(client),
    subscribe(onChange) {
      listeners.add(onChange);
      if (!stop) {
        store.keys = pendingKeys(client);
        stop = client.getMutationCache().subscribe(() => {
          const next = pendingKeys(client);
          if (same(next, store.keys)) return;
          store.keys = next;
          for (const listener of listeners) listener();
        });
      }
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0 && stop) {
          stop();
          stop = null;
        }
      };
    },
  };
  stores.set(client, store);
  return store;
}

/** True while an edit to this issue is on its way; its card or row shows it quietly. */
export function useIssuePending(key: string): boolean {
  const store = storeFor(useQueryClient());
  const subscribe = useCallback((onChange: () => void) => store.subscribe(onChange), [store]);
  return useSyncExternalStore(
    subscribe,
    () => store.keys.has(key),
    () => false,
  );
}
