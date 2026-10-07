import type { DomainEvent, EventBus, EventHandler } from '../contracts/event-bus.ts';

/** In-process bus; handlers for one kind run in subscription order. */
export function createLocalEventBus(): EventBus {
  const handlers = new Map<string, Set<EventHandler>>();
  return {
    async publish(event: DomainEvent) {
      for (const handler of handlers.get(event.kind) ?? []) {
        await handler(event);
      }
    },
    subscribe(kind, handler) {
      const set = handlers.get(kind) ?? new Set<EventHandler>();
      set.add(handler);
      handlers.set(kind, set);
      return () => set.delete(handler);
    },
  };
}
