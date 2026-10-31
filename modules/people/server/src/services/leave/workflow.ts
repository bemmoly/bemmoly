import type { Approvals, SqlExecutor } from '@bemmoly/core';
import type { ApprovalEventPayload } from '@bemmoly/shared/approvals';
import type { LeaveStatus } from '../../../../shared/leave.ts';

export const LEAVE_WORKFLOW_KEY = 'people.leave';
export const LEAVE_SUBJECT = 'leave_request';

/**
 * People's default: the requester's manager approves. Admins may save later versions through
 * the approval engine's admin API; this one is written only when none exists.
 */
export const LEAVE_WORKFLOW = {
  moduleId: 'people',
  key: LEAVE_WORKFLOW_KEY,
  name: 'Time off',
  spec: {
    stages: [{ name: 'Manager', approvers: [{ type: 'manager' as const, levels: 1 }] }],
  },
};

/** Saves the default once per process; the engine itself never overwrites an existing one. */
export function createWorkflowEnsurer(approvals: Approvals) {
  let ensured: Promise<void> | null = null;
  return () => {
    ensured ??= approvals.ensureWorkflow(LEAVE_WORKFLOW).catch((error: unknown) => {
      ensured = null;
      throw error;
    });
    return ensured;
  };
}

const OUTCOMES: Record<string, LeaveStatus> = {
  'approval.approved': 'approved',
  'approval.rejected': 'rejected',
  'approval.withdrawn': 'withdrawn',
};

export const LEAVE_OUTCOME_EVENTS = Object.keys(OUTCOMES);

/**
 * Moves a pending request to the engine's outcome, inside the engine's transaction. Events for
 * other modules' subjects, and a request already closed, change nothing.
 */
export async function applyOutcome(
  sql: SqlExecutor,
  kind: string,
  payload: ApprovalEventPayload,
): Promise<string | null> {
  const status = OUTCOMES[kind];
  if (!status || payload.moduleId !== 'people' || payload.subject.kind !== LEAVE_SUBJECT) {
    return null;
  }
  const rows = await sql<{ id: string }[]>`
    update leave_requests set status = ${status}, updated_at = now()
    where id = ${payload.subject.id} and status = 'pending'
    returning id`;
  return rows[0]?.id ?? null;
}
