import { realtimeMessageSchema } from '@bemmoly/shared';
import type { SqlClient } from '../../clients/postgres.ts';
import type { Logger } from '../../config/logger.ts';
import type { Unsubscribe } from '../../contracts/event-bus.ts';
import type { RealtimeMessage } from '../../contracts/realtime.ts';
import { AUTHZ_CHANNEL, DOMAIN_EVENTS_CHANNEL, REALTIME_CHANNEL } from './notify.ts';

export type MessageHandler = (message: RealtimeMessage) => Promise<void> | void;
export type RawHandler = (payload: string) => Promise<void> | void;

export interface RealtimeListener {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Invalidation messages from every process, including this one. */
  onMessage(handler: MessageHandler): Unsubscribe;
  onDomainEvent(handler: RawHandler): Unsubscribe;
  /**
   * A role, membership, grant, user or API token changed somewhere (the 0114 triggers), or
   * the LISTEN connection (re)connected and may have missed such a change.
   */
  onAuthorizationChange(handler: () => void): Unsubscribe;
}

/**
 * One LISTEN connection per process (postgres.js keeps it dedicated and
 * reconnects it). Handler failures are logged, never thrown into the driver.
 */
export function createRealtimeListener(sql: SqlClient, logger: Logger): RealtimeListener {
  const messageHandlers = new Set<MessageHandler>();
  const domainHandlers = new Set<RawHandler>();
  const authzHandlers = new Set<() => void>();
  const unlisteners: (() => Promise<void>)[] = [];

  const run = (handler: () => Promise<void> | void, channel: string) => {
    Promise.resolve()
      .then(handler)
      .catch((error: unknown) => logger.error({ err: error, channel }, 'realtime handler failed'));
  };

  const onRealtime = (payload: string) => {
    let message: RealtimeMessage;
    try {
      message = realtimeMessageSchema.parse(JSON.parse(payload));
    } catch (error) {
      logger.warn(
        { err: error, channel: REALTIME_CHANNEL },
        'ignored a malformed realtime message',
      );
      return;
    }
    for (const handler of messageHandlers) run(() => handler(message), REALTIME_CHANNEL);
  };

  const onDomain = (payload: string) => {
    for (const handler of domainHandlers) run(() => handler(payload), DOMAIN_EVENTS_CHANNEL);
  };

  const onAuthz = () => {
    for (const handler of authzHandlers) run(handler, AUTHZ_CHANNEL);
  };

  return {
    async start() {
      if (unlisteners.length > 0) return;
      const realtime = await sql.listen(REALTIME_CHANNEL, onRealtime);
      const domain = await sql.listen(DOMAIN_EVENTS_CHANNEL, onDomain);
      // postgres.js calls the third argument on every (re)connect: anything sent while the
      // connection was down is lost, so the caches start over then too.
      const authz = await sql.listen(AUTHZ_CHANNEL, onAuthz, onAuthz);
      unlisteners.push(realtime.unlisten, domain.unlisten, authz.unlisten);
    },
    async stop() {
      const pending = unlisteners.splice(0);
      await Promise.all(pending.map((unlisten) => unlisten()));
    },
    onMessage(handler) {
      messageHandlers.add(handler);
      return () => messageHandlers.delete(handler);
    },
    onDomainEvent(handler) {
      domainHandlers.add(handler);
      return () => domainHandlers.delete(handler);
    },
    onAuthorizationChange(handler) {
      authzHandlers.add(handler);
      return () => authzHandlers.delete(handler);
    },
  };
}
