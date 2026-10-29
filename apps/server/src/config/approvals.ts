import {
  createAuditRecorder,
  createCustomFieldsService,
  createPersonOrgLookup,
  wireApprovals,
  wirePeople,
  type ApprovalsWired,
  type CustomFieldsService,
  type People,
} from '@bemmoly/core';
import type { DatabaseConnection } from './database.ts';
import type { IdentityWiring } from './identity.ts';
import type { DataKernel } from './kernel.ts';

export interface ApprovalsWiringInput {
  database: DatabaseConnection;
  kernel: DataKernel;
  identity: IdentityWiring;
}

export interface SuiteServices {
  people: People;
  approvals: ApprovalsWired['service'];
  customFields: CustomFieldsService;
}

/**
 * The kernel services the suite's products share: the person record, the approval engine
 * (its escalation job registered before the jobs service starts, its managers and cost-centre
 * owners answered by the person record) and typed custom fields.
 */
export function wireSuiteServices(input: ApprovalsWiringInput): SuiteServices {
  const { database, kernel, identity } = input;
  const people = wirePeople({
    sql: database.sql,
    authorize: identity.authorize,
    events: kernel.events,
  });
  const approvals = wireApprovals({
    sql: database.sql,
    jobs: kernel.jobs,
    events: kernel.events,
    authorize: identity.authorize,
    org: createPersonOrgLookup(people.directory),
  }).service;
  const customFields = createCustomFieldsService({
    sql: database.sql,
    authorize: identity.authorize,
    audit: createAuditRecorder(database.sql),
    events: kernel.events,
  });
  return { people, approvals, customFields };
}
