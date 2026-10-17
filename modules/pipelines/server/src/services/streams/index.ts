import type { RequestContext } from '@bemmoly/core';
import type { StreamEvent } from '../../../../shared/streams.ts';
import {
  authorizePipelines,
  personOf,
  requireDatabase,
  type PipelinesServiceDeps,
} from '../deps.ts';
import { liveCounter } from '../overview/index.ts';
import { createStreamHub, type StreamHub, type StreamSubscriber } from './hub.ts';
import { listenForStreamEvents } from './publish.ts';

export { publishStreamEvent } from './publish.ts';
export { createStreamHub, type StreamHub } from './hub.ts';

export interface StreamsDeps extends PipelinesServiceDeps {
  /** One per process; built from the database when not given. */
  hub?: StreamHub;
}

/**
 * The live streams under /api/v1/pipelines/streams. Opening one checks the person may use
 * Pipelines; what each topic shows is read through the endpoints the client refetches, which
 * check their own access, so an event never carries more than a pointer and a state.
 */
export function createStreamsService(deps: StreamsDeps) {
  const hub =
    deps.hub ??
    createStreamHub(deps.database ? { listen: listenForStreamEvents(deps.database) } : {});
  return {
    hub,

    async open(
      ctx: RequestContext,
      topics: readonly string[],
      send: (event: StreamEvent) => void,
    ): Promise<{ initial: StreamEvent[]; close: () => void }> {
      await authorizePipelines(ctx);
      const subscriber: StreamSubscriber = { topics, userId: personOf(ctx.actor), send };
      const close = hub.subscribe(subscriber);
      const initial: StreamEvent[] = [];
      // The counter is in every top bar, so a new stream starts with today's value at once.
      if (topics.includes('live') && deps.database) {
        const sql = requireDatabase(deps);
        const data = await liveCounter(sql, { domain: null, group: null });
        initial.push({ topic: 'live', kind: 'counter', at: new Date().toISOString(), data });
      }
      return { initial, close };
    },
  };
}

export type StreamsService = ReturnType<typeof createStreamsService>;
