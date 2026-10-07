import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SqlClient } from '../../clients/postgres.ts';
import type { Logger } from '../../config/logger.ts';
import type {
  ClusterEventBus,
  DomainEvent,
  EventHandler,
  Unsubscribe,
} from '../../contracts/event-bus.ts';
import { createLocalEventBus } from '../../modules/local-event-bus.ts';
import { DOMAIN_EVENTS_CHANNEL, encodePayload, notify } from './notify.ts';

const envelopeSchema = z.object({
  origin: z.string(),
  event: z.object({
    kind: z.string(),
    occurredAt: z.iso.datetime(),
    actor: z
      .object({
        kind: z.enum(['user', 'api_token', 'ai_plan', 'system']),
        id: z.string(),
        userId: z.string().optional(),
      })
      .optional(),
    entity: z.object({ kind: z.string(), id: z.string() }).optional(),
    payload: z.unknown(),
  }),
});

export interface ReplicatedEventBus extends ClusterEventBus {
  /** Feeds one NOTIFY payload from the domain events channel. */
  receive(payload: string): Promise<void>;
  readonly origin: string;
}

export interface ReplicatedEventBusOptions {
  sql: SqlClient;
  logger: Logger;
}

/**
 * Domain events, in process and across replicas. Payloads must stay small
 * (ids, not documents) because NOTIFY carries them.
 */
export function createReplicatedEventBus(options: ReplicatedEventBusOptions): ReplicatedEventBus {
  const origin = randomUUID();
  const local = createLocalEventBus();
  const everywhere = new Map<string, Set<EventHandler>>();

  return {
    origin,
    async publish(event: DomainEvent) {
      const { transaction, ...portable } = event;
      const envelope = {
        origin,
        event: { ...portable, occurredAt: event.occurredAt.toISOString() },
      };
      const payload = encodePayload(envelope, `Domain event "${event.kind}"`);
      // In-process handlers run first and may throw back to the publisher;
      // other replicas hear of the event only once the transaction commits.
      await local.publish(event);
      await notify(transaction ?? options.sql, DOMAIN_EVENTS_CHANNEL, payload);
    },
    subscribe: (kind, handler) => local.subscribe(kind, handler),
    subscribeEverywhere(kind, handler): Unsubscribe {
      const set = everywhere.get(kind) ?? new Set<EventHandler>();
      set.add(handler);
      everywhere.set(kind, set);
      return () => set.delete(handler);
    },
    async receive(payload) {
      const parsed = envelopeSchema.safeParse(JSON.parse(payload));
      if (!parsed.success) {
        options.logger.warn({ channel: DOMAIN_EVENTS_CHANNEL }, 'ignored a malformed domain event');
        return;
      }
      const { event } = parsed.data;
      const domainEvent: DomainEvent = {
        kind: event.kind,
        occurredAt: new Date(event.occurredAt),
        payload: event.payload,
        ...(event.actor ? { actor: event.actor } : {}),
        ...(event.entity ? { entity: event.entity } : {}),
      };
      for (const handler of everywhere.get(event.kind) ?? []) await handler(domainEvent);
    },
  };
}
