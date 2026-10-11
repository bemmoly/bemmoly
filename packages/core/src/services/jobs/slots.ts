/** Job handlers running at once in one process when the host names no limit. */
export const DEFAULT_JOB_HANDLER_LIMIT = 4;

/**
 * A process-wide cap on job handlers running at once. Handlers share the request pool, so
 * the host sets the cap below its size and a burst of jobs can never take every connection.
 * Waiters are served in arrival order, so one busy queue cannot starve the others.
 */
export interface JobSlots {
  readonly limit: number;
  /** Runs `task` once a slot is free; an aborted `signal` gives up the wait. */
  run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T>;
  /** Handlers running now. */
  active(): number;
  /** Handlers waiting for a slot. */
  waiting(): number;
}

interface Waiter {
  grant(): void;
}

export function createJobSlots(limit: number = DEFAULT_JOB_HANDLER_LIMIT): JobSlots {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(`The job handler limit must be a positive integer, not ${limit}`);
  }
  let active = 0;
  const queue: Waiter[] = [];

  function release(): void {
    // A freed slot passes straight to the longest waiter, so `active` only drops when none wait.
    const next = queue.shift();
    if (next) next.grant();
    else active -= 1;
  }

  function acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(signal.reason as Error);
    if (active < limit) {
      active += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        const index = queue.indexOf(waiter);
        if (index >= 0) queue.splice(index, 1);
        reject(signal?.reason as Error);
      };
      const waiter: Waiter = {
        grant: () => {
          signal?.removeEventListener('abort', onAbort);
          resolve();
        },
      };
      queue.push(waiter);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  return {
    limit,
    async run(task, signal) {
      await acquire(signal);
      try {
        return await task();
      } finally {
        release();
      }
    },
    active: () => active,
    waiting: () => queue.length,
  };
}
