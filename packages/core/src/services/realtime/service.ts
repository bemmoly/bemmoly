import type { SqlClient } from '../../clients/postgres.ts';
import type { Logger } from '../../config/logger.ts';
import type { RealtimePublisher } from '../../contracts/realtime.ts';
import { createReplicatedEventBus, type ReplicatedEventBus } from './event-bus.ts';
import { createRealtimeHub, type RealtimeHub, type RealtimeHubOptions } from './hub.ts';
import { createRealtimeListener, type RealtimeListener } from './listener.ts';
import { createNotifyPublisher } from './notify.ts';

export interface RealtimeServiceOptions {
  sql: SqlClient;
  logger: Logger;
  hub?: Omit<RealtimeHubOptions, 'logger'>;
}

/** Everything realtime in one process: publish, listen, fan out, replicate events. */
export interface RealtimeService {
  publisher: RealtimePublisher;
  listener: RealtimeListener;
  hub: RealtimeHub;
  events: ReplicatedEventBus;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createRealtimeService(options: RealtimeServiceOptions): RealtimeService {
  const { sql, logger } = options;
  const listener = createRealtimeListener(sql, logger);
  const hub = createRealtimeHub({ ...options.hub, logger });
  const events = createReplicatedEventBus({ sql, logger });
  listener.onMessage((message) => {
    hub.dispatch(message);
  });
  listener.onDomainEvent((payload) => events.receive(payload));
  return {
    publisher: createNotifyPublisher(sql),
    listener,
    hub,
    events,
    start: () => listener.start(),
    async stop() {
      hub.closeAll();
      await listener.stop();
    },
  };
}
