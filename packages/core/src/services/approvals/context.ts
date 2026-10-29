import type { SqlClient } from '../../clients/postgres.ts';
import type { ApproverResolver } from '../../contracts/approvals.ts';
import type { AuditRecorder } from '../../contracts/audit.ts';
import type { Actor, Authorize } from '../../contracts/authz.ts';
import type { EventBus } from '../../contracts/event-bus.ts';
import type { JobQueue } from '../../contracts/jobs.ts';

/** One run per task whose SLA passed; the handler re-reads the task before acting. */
export const APPROVAL_ESCALATE_JOB = 'approval.escalate';

/** Defining workflows changes how the workspace runs: a workspace settings change. */
export const APPROVALS_ADMIN_CAPABILITY = 'workspace.settings.manage';

export const WORKSPACE = { kind: 'workspace' } as const;

/** The actor of escalations, which no person causes. */
export const ESCALATION_ACTOR: Actor = { kind: 'system', id: 'approvals:escalation' };

export interface ApprovalDeps {
  sql: SqlClient;
  authorize: Authorize;
  audit: AuditRecorder;
  jobs: JobQueue;
  events: EventBus;
  resolver: ApproverResolver;
  now?: () => Date;
}

export const nowOf = (deps: ApprovalDeps): Date => deps.now?.() ?? new Date();

/** The person behind an actor: a user, or the user a token or plan acts for. */
export const userIdOf = (actor: Actor): string | null =>
  actor.userId ?? (actor.kind === 'user' ? actor.id : null);
