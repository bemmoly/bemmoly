import type { SqlClient } from '../../clients/postgres.ts';
import type { Authorize } from '../../contracts/authz.ts';
import type { EventBus } from '../../contracts/event-bus.ts';
import type { PersonDirectory } from '../../contracts/people.ts';
import { createAuditRecorder } from '../audit/index.ts';
import { createPersonDirectory } from './directory.ts';
import { createOrgEntities, type OrgEntities } from './org.ts';
import { createPeopleRecords, type PeopleRecords } from './records.ts';

export interface PeopleWiring {
  sql: SqlClient;
  authorize: Authorize;
  events: EventBus;
  now?: () => Date;
}

/** The person record's services: the directory products read, and the API's writes. */
export interface People {
  directory: PersonDirectory;
  records: PeopleRecords;
  org: OrgEntities;
}

export function wirePeople(wiring: PeopleWiring): People {
  const deps = { ...wiring, audit: createAuditRecorder(wiring.sql) };
  return {
    directory: createPersonDirectory(wiring.sql),
    records: createPeopleRecords(deps),
    org: createOrgEntities(deps),
  };
}
