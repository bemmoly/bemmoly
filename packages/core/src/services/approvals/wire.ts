import { z } from 'zod';
import type { SqlClient } from '../../clients/postgres.ts';
import type { ApproverResolver, OrgLookup } from '../../contracts/approvals.ts';
import type { Authorize } from '../../contracts/authz.ts';
import type { EventBus } from '../../contracts/event-bus.ts';
import type { JobQueue } from '../../contracts/jobs.ts';
import { createAuditRecorder } from '../audit/index.ts';
import { APPROVAL_ESCALATE_JOB, type ApprovalDeps } from './context.ts';
import { escalateTask } from './escalation.ts';
import { createDirectoryResolver, noOrgLookup } from './resolvers/index.ts';
import { createApprovalsService, type ApprovalsService } from './service.ts';

export interface ApprovalsWiring {
  sql: SqlClient;
  jobs: JobQueue;
  events: EventBus;
  authorize: Authorize;
  /** Managers and cost-centre owners; the person record supplies one. */
  org?: OrgLookup;
  /** Replaces the default resolver outright; `org` is then unused. */
  resolver?: ApproverResolver;
  now?: () => Date;
}

export interface ApprovalsWired {
  service: ApprovalsService;
  /** Runs one escalation now, as the queue would; for tests. */
  escalate(taskId: string): Promise<void>;
}

const payloadSchema = z.object({ taskId: z.uuid() });

/** The approval engine and its escalation job, registered before the jobs service starts. */
export function wireApprovals(wiring: ApprovalsWiring): ApprovalsWired {
  const deps: ApprovalDeps = {
    sql: wiring.sql,
    authorize: wiring.authorize,
    audit: createAuditRecorder(wiring.sql),
    jobs: wiring.jobs,
    events: wiring.events,
    resolver: wiring.resolver ?? createDirectoryResolver(wiring.sql, wiring.org ?? noOrgLookup),
    ...(wiring.now ? { now: wiring.now } : {}),
  };
  wiring.jobs.register(
    APPROVAL_ESCALATE_JOB,
    async (payload) => escalateTask(deps, payloadSchema.parse(payload).taskId),
    { retryLimit: 3, retryDelaySeconds: 60, retryBackoff: true },
  );
  return {
    service: createApprovalsService(deps),
    escalate: (taskId) => escalateTask(deps, taskId),
  };
}
