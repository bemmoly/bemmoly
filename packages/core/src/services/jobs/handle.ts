import type { JobQueue } from '../../contracts/jobs.ts';

/**
 * A JobQueue that can be handed out before the jobs service exists (modules
 * are loaded first, because the jobs service needs their contributions) and
 * bound once it does. Registrations made before binding are replayed;
 * enqueueing before binding fails with a clear message.
 */
export interface JobQueueHandle extends JobQueue {
  bind(queue: JobQueue): void;
}

export function createJobQueueHandle(): JobQueueHandle {
  let target: JobQueue | undefined;
  const pending: ((queue: JobQueue) => void)[] = [];
  return {
    bind(queue) {
      target = queue;
      for (const replay of pending.splice(0)) replay(queue);
    },
    register(name, handler, options) {
      const replay = (queue: JobQueue) => queue.register(name, handler, options);
      if (target) replay(target);
      else pending.push(replay);
    },
    enqueue(name, payload, options) {
      if (!target) throw new Error(`Cannot enqueue "${name}": the jobs service has not started`);
      return target.enqueue(name, payload, options);
    },
  };
}
