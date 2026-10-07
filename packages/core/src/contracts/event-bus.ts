import type { Actor } from './authz.ts';
import type { SqlExecutor } from './sql.ts';

export interface EntityRef {
  kind: string;
  id: string;
}

/** A typed domain event such as `issue.transitioned` or `page.published`. */
export interface DomainEvent<Kind extends string = string, Payload = unknown> {
  kind: Kind;
  occurredAt: Date;
  actor?: Actor;
  entity?: EntityRef;
  payload: Payload;
  /**
   * The publisher's open transaction, when it has one. In-process handlers that
   * write (inbox rows, outbox rows) join it so they commit or roll back together.
   */
  transaction?: SqlExecutor;
}

export type EventHandler<Event extends DomainEvent = DomainEvent> = (
  event: Event,
) => Promise<void> | void;

export type Unsubscribe = () => void;

/** Modules publish and subscribe by event kind, never by importing each other. */
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(kind: string, handler: EventHandler): Unsubscribe;
}

/**
 * The kernel's bus across replicas. `subscribe` handlers run once, in the
 * process that published (use them, or a job, for side effects such as
 * notifications). `subscribeEverywhere` handlers run in every process,
 * delivered over NOTIFY after commit, for in-memory state such as caches.
 */
export interface ClusterEventBus extends EventBus {
  subscribeEverywhere(kind: string, handler: EventHandler): Unsubscribe;
}
