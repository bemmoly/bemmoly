import { mergeUpdates } from 'yjs';
import type { Logger } from '../../config/logger.ts';
import type { Actor } from '../../contracts/authz.ts';

export type StoreUpdate = (name: string, update: Uint8Array, actor: Actor | null) => Promise<void>;

interface Pending {
  update: Uint8Array;
  actor: Actor | null;
}

interface Queue {
  pending: Pending[];
  draining: Promise<void> | null;
}

/** Retry delays for a store that failed; the last one repeats until the store succeeds. */
const RETRY_MS = [250, 1_000, 4_000, 15_000] as const;

const actorKey = (actor: Actor | null) => (actor ? `${actor.kind}:${actor.id}` : '');

export interface UpdateWriter {
  /** Queues one update; it is stored after every update queued before it. */
  push(name: string, update: Uint8Array, actor: Actor | null): void;
  /** Resolves once everything queued for the document (or every document) is stored. */
  flush(name?: string): Promise<void>;
  /** Updates queued and not yet stored, across documents. */
  pendingCount(): number;
}

/**
 * Persists a document's updates strictly in order, one store call at a time. Updates that
 * arrive while a store is running are merged per actor into the next call, so a burst of
 * keystrokes becomes a handful of rows rather than one per key. A failed store is retried
 * with backoff and never skipped: a gap in a Yjs log would leave every later update pending.
 */
export function createUpdateWriter(options: {
  store: StoreUpdate;
  logger: Logger;
  sleep?: (ms: number) => Promise<void>;
}): UpdateWriter {
  const queues = new Map<string, Queue>();
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  /** The leading run of updates by one actor, merged, and how many queued updates it holds. */
  function takeBatch(queue: Queue): { batch: Pending; count: number } {
    const first = queue.pending[0]!;
    const key = actorKey(first.actor);
    let count = 1;
    while (count < queue.pending.length && actorKey(queue.pending[count]!.actor) === key) {
      count += 1;
    }
    const updates = queue.pending.slice(0, count).map((item) => item.update);
    return {
      batch: { update: count === 1 ? first.update : mergeUpdates(updates), actor: first.actor },
      count,
    };
  }

  async function storeWithRetry(name: string, batch: Pending): Promise<void> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        await options.store(name, batch.update, batch.actor);
        return;
      } catch (error) {
        const delay = RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]!;
        options.logger.error(
          { err: error, document: name, attempt: attempt + 1, retryInMs: delay },
          'storing a collaborative update failed; retrying',
        );
        await sleep(delay);
      }
    }
  }

  async function drain(name: string, queue: Queue): Promise<void> {
    while (queue.pending.length > 0) {
      const { batch, count } = takeBatch(queue);
      await storeWithRetry(name, batch);
      queue.pending.splice(0, count);
    }
    queue.draining = null;
    queues.delete(name);
  }

  return {
    push(name, update, actor) {
      let queue = queues.get(name);
      if (!queue) {
        queue = { pending: [], draining: null };
        queues.set(name, queue);
      }
      queue.pending.push({ update, actor });
      queue.draining ??= drain(name, queue);
    },
    async flush(name) {
      const targets = name ? [queues.get(name)] : [...queues.values()];
      await Promise.all(targets.map((queue) => queue?.draining));
    },
    pendingCount() {
      let count = 0;
      for (const queue of queues.values()) count += queue.pending.length;
      return count;
    },
  };
}
