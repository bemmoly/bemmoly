import type {
  CostCentre,
  EmploymentState,
  Location,
  Person,
  PersonChangedPayload,
  PersonJoinedPayload,
  PersonLeavingPayload,
  PersonLeftPayload,
} from '@bemmoly/shared/people';
import type { DomainEvent } from './event-bus.ts';
import type { SqlExecutor } from './sql.ts';

export type { CostCentre, EmploymentState, Location, Person } from '@bemmoly/shared/people';

/** Filters for `PersonDirectory.list`; every one given must match. */
export interface PeopleFilter {
  teamId?: string;
  locationId?: string;
  costCentreId?: string;
  managerId?: string;
  /** One state or several; without it every state is listed, `left` included. */
  states?: readonly EmploymentState[];
}

/**
 * The kernel's person record, read by every product (ADR 0050). People are keyed by their
 * user id. Reads take an optional transaction so a module can read inside its own write.
 * Writing goes through the People API, never through this.
 */
export interface PersonDirectory {
  /** Null when the user has no person record. */
  get(userId: string, transaction?: SqlExecutor): Promise<Person | null>;
  /** Unknown ids are left out. */
  getMany(userIds: readonly string[], transaction?: SqlExecutor): Promise<Person[]>;
  /** The person's manager, their manager, and so on up; nearest first, the person excluded. */
  managerChain(userId: string, transaction?: SqlExecutor): Promise<Person[]>;
  /** Direct reports, or with `all` everyone below, nearest first. */
  reports(
    userId: string,
    options?: { all?: boolean },
    transaction?: SqlExecutor,
  ): Promise<Person[]>;
  /** Ordered by name. */
  list(filter: PeopleFilter, transaction?: SqlExecutor): Promise<Person[]>;
  location(id: string, transaction?: SqlExecutor): Promise<Location | null>;
  costCentre(id: string, transaction?: SqlExecutor): Promise<CostCentre | null>;
}

export type PersonJoinedEvent = DomainEvent<'person.joined', PersonJoinedPayload>;
export type PersonChangedEvent = DomainEvent<'person.changed', PersonChangedPayload>;
export type PersonLeavingEvent = DomainEvent<'person.leaving', PersonLeavingPayload>;
export type PersonLeftEvent = DomainEvent<'person.left', PersonLeftPayload>;
export type PersonEvent =
  PersonJoinedEvent | PersonChangedEvent | PersonLeavingEvent | PersonLeftEvent;
