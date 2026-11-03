/*
 * Row shapes of the change request tables as the change request services select them.
 * Schema only: the tables are defined by changesets 0033 and 0035 in changelog/.
 */

export interface ChangeRequestRow {
  id: string;
  number: string;
  environment_id: string;
  environment_key: string;
  environment_name: string;
  title: string;
  why: string;
  risk: 'low' | 'medium' | 'high';
  deploy_at: string | null;
  rollback: string;
  status: string;
  requested_by: string | null;
  requester_name: string | null;
  emergency_reason: string | null;
  sent_at: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChangeRequestItemRow {
  id: string;
  application_id: string;
  application_key: string;
  application_name: string;
  release_id: string;
  version: string;
  run_id: string | null;
  from_release_id: string | null;
  from_version: string | null;
  promotion_id: string | null;
  promotion_state: string | null;
}

export interface ChangeRequestStepRow {
  id: string;
  position: number;
  group_id: string | null;
  group_name: string;
  count: number;
  condition: 'always' | 'high_risk';
  state: 'queued' | 'waiting' | 'approved' | 'rejected';
}

export interface ChangeRequestPickRow {
  step_id: string;
  user_id: string;
  name: string;
}

export interface ChangeRequestDecisionRow {
  step_id: string;
  user_id: string | null;
  name: string | null;
  decision: 'approved' | 'rejected' | 'changes_requested';
  note: string | null;
  created_at: string;
}

export interface ChangeRequestEventRow {
  user_id: string | null;
  name: string | null;
  kind: string;
  data: Record<string, unknown>;
  created_at: string;
}

/** An environment as a change request reads it: its rule, window and place on the path. */
export interface ChangeEnvironmentRow {
  id: string;
  key: string;
  name: string;
  position: number;
  approval_rule: { steps: Array<{ group: string; count: number; when: string }> } | null;
  deploy_window: {
    days: string[];
    from: string;
    to: string;
    timeZone: string;
  } | null;
  versions_allowed: 'any' | 'passed_previous';
  deployers: { users?: string[]; groups?: string[] } | null;
}
