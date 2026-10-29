import { wireApprovals, type ApprovalsWired } from '@bemmoly/core';
import type { DatabaseConnection } from './database.ts';
import type { IdentityWiring } from './identity.ts';
import type { DataKernel } from './kernel.ts';

export interface ApprovalsWiringInput {
  database: DatabaseConnection;
  kernel: DataKernel;
  identity: IdentityWiring;
}

/**
 * The approval engine and its escalation job, registered before the jobs service starts.
 * Managers and cost-centre owners stay unknown until the person record supplies an OrgLookup.
 */
export function wireApprovalEngine(input: ApprovalsWiringInput): ApprovalsWired {
  return wireApprovals({
    sql: input.database.sql,
    jobs: input.kernel.jobs,
    events: input.kernel.events,
    authorize: input.identity.authorize,
  });
}
