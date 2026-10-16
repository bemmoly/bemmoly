import type { CodeEvent, CodeEventOf, RequestContext } from '@bemmoly/core';

/*
 * Who acts on which event, registered once at boot: the push processor (runs, application
 * .yaml sync), pull request and merge queue triggers, checks as gates, discovery. Handlers
 * are called in order per repository, at least once: they must be idempotent.
 */

export type InboxEventType = CodeEvent['type'];
export type InboxEvent<T extends InboxEventType = InboxEventType> = Extract<
  CodeEventOf,
  { type: T }
>;
export type InboxHandler<T extends InboxEventType = InboxEventType> = (
  event: InboxEvent<T>,
  ctx: RequestContext,
) => Promise<void>;

export interface InboxHandlers {
  on<T extends InboxEventType>(type: T, handler: InboxHandler<T>): void;
  for(type: string): readonly InboxHandler[];
}

export function createInboxHandlers(): InboxHandlers {
  const handlers = new Map<string, InboxHandler[]>();
  return {
    on(type, handler) {
      handlers.set(type, [...(handlers.get(type) ?? []), handler as unknown as InboxHandler]);
    },
    for: (type) => handlers.get(type) ?? [],
  };
}
