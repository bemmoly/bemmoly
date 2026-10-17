import type { SqlClient } from '@bemmoly/core';
import { DISPATCH_CHANNEL } from '../orchestrator/advance.ts';

/*
 * LISTEN/NOTIFY wake-ups for long-polling runners (architecture §5.1): a claim that finds
 * nothing waits here until a job becomes ready in its pool (NOTIFY from whichever replica
 * made it ready) or its wait runs out, so there is no polling delay and no polling load.
 * One listener connection per process, opened on the first wait.
 */

export interface DispatchWakeups {
  /** Resolves true when the pool may have work, false when the wait ran out or was aborted. */
  wait(poolId: string, ms: number, signal?: AbortSignal): Promise<boolean>;
  /** Wakes local waiters directly, for jobs readied in this process. */
  wake(poolId: string): void;
  stop(): Promise<void>;
}

export function createDispatchWakeups(sql: SqlClient | undefined): DispatchWakeups {
  const waiters = new Map<string, Set<() => void>>();
  let listening: Promise<{ unlisten: () => Promise<void> }> | null = null;

  const wake = (poolId: string) => {
    const set = waiters.get(poolId);
    if (!set) return;
    waiters.delete(poolId);
    for (const resolve of set) resolve();
  };

  const listen = () => {
    if (listening || !sql) return;
    listening = sql.listen(DISPATCH_CHANNEL, (poolId) => wake(poolId));
    // A failed LISTEN must not break claims: waits still end on their timeout.
    listening.catch(() => {
      listening = null;
    });
  };

  return {
    wake,
    wait(poolId, ms, signal) {
      listen();
      return new Promise<boolean>((resolve) => {
        let set = waiters.get(poolId);
        if (!set) {
          set = new Set();
          waiters.set(poolId, set);
        }
        const done = (woken: boolean) => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          waiters.get(poolId)?.delete(onWake);
          resolve(woken);
        };
        const onWake = () => done(true);
        const onAbort = () => done(false);
        const timer = setTimeout(() => done(false), ms);
        set.add(onWake);
        signal?.addEventListener('abort', onAbort, { once: true });
      });
    },
    async stop() {
      for (const poolId of [...waiters.keys()]) wake(poolId);
      const current = listening;
      listening = null;
      if (current) await (await current).unlisten();
    },
  };
}
