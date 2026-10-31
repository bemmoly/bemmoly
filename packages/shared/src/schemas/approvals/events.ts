import type { ApprovalDecision, ApprovalStatus, ApprovalSubject } from './requests.ts';

/** Bus events of the approval engine; the owning module filters on `moduleId`. */
export const APPROVAL_EVENT_KINDS = {
  requested: 'approval.requested',
  stageStarted: 'approval.stage_started',
  decided: 'approval.decided',
  escalated: 'approval.escalated',
  approved: 'approval.approved',
  rejected: 'approval.rejected',
  withdrawn: 'approval.withdrawn',
} as const;

export type ApprovalEventKind = (typeof APPROVAL_EVENT_KINDS)[keyof typeof APPROVAL_EVENT_KINDS];

export interface ApprovalEventPayload {
  requestId: string;
  moduleId: string;
  workflowKey: string;
  subject: ApprovalSubject;
  requesterId: string;
  status: ApprovalStatus;
  stage: number | null;
  /** On `approval.decided`: who decided what. */
  decision?: { approverId: string; decision: ApprovalDecision; comment: string | null };
}

/** Notification kinds the engine sends; both go out at once. */
export const APPROVAL_NOTIFICATION_KINDS = {
  requested: 'approval_requested',
  decided: 'approval_decided',
} as const;
