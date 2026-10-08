import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import type {
  AvailableTransition,
  StatusCategory,
  WorkflowRule,
} from '../../../../shared/index.ts';

/**
 * The columns of an issue the workflow reads. The issues stream passes its
 * own row; only these names are read, so the two streams share no row type.
 */
export interface WorkflowIssue {
  id: string;
  key: string;
  project_id: string;
  type_id: string;
  status_id: string;
  assignee_id: string | null;
  reporter_id: string | null;
  sprint_id: string | null;
  estimate: number | string | null;
  resolved_at: Date | string | null;
  custom_fields: Record<string, unknown>;
}

export interface TransitionTarget {
  id: string;
  name: string;
  category: StatusCategory;
}

/** What a passed transition hands back: the issues service writes the status, then runs these. */
export interface TransitionResult {
  transitionId: string;
  toStatus: TransitionTarget;
  postActions: WorkflowRule[];
}

/**
 * The gate the issues service calls before it moves an issue. `transition`
 * throws a typed error when the move is not allowed; the caller commits the
 * status change, then runs the post-actions it returned.
 */
export interface TransitionGate {
  canTransition(ctx: RequestContext, issue: WorkflowIssue): Promise<AvailableTransition[]>;
  transition(
    ctx: RequestContext,
    issue: WorkflowIssue,
    toStatusId: string,
    submitted: Record<string, unknown>,
    sql?: SqlExecutor,
  ): Promise<TransitionResult>;
  runPostActions(
    ctx: RequestContext,
    issue: WorkflowIssue,
    actions: readonly WorkflowRule[],
  ): Promise<void>;
}
