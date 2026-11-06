import type { SqlClient } from '../../clients/postgres.ts';
import type { AuditRecorder } from '../../contracts/audit.ts';
import type { Actor, Authorize } from '../../contracts/authz.ts';
import type { EventBus } from '../../contracts/event-bus.ts';

/** Creating and changing records, locations and cost centres (ADR 0050). */
export const PEOPLE_CAPABILITY = 'workspace.people.manage';

export const WORKSPACE = { kind: 'workspace' } as const;

export interface PeopleDeps {
  sql: SqlClient;
  authorize: Authorize;
  audit: AuditRecorder;
  events: EventBus;
  now?: () => Date;
}

export const manage = (deps: PeopleDeps, actor: Actor) =>
  deps.authorize(actor, PEOPLE_CAPABILITY, WORKSPACE);

export const nowOf = (deps: PeopleDeps) => deps.now?.() ?? new Date();
