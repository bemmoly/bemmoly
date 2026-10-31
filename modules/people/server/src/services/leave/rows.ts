import type { SqlExecutor } from '@bemmoly/core';
import type {
  LeaveKind,
  LeavePolicy,
  LeaveRequest,
  LeaveStatus,
} from '../../../../shared/leave.ts';
import { dateOf, iso } from '../common.ts';

export interface PolicyRow {
  id: string;
  name: string;
  kind: LeaveKind;
  location_id: string | null;
  allowance_days: string | number | null;
  carry_over_days: string | number;
  needs_approval: boolean;
  archived_at: Date | null;
}

export interface RequestRow {
  id: string;
  user_id: string;
  policy_id: string;
  kind: LeaveKind;
  start_date: Date | string;
  end_date: Date | string;
  half_day: boolean;
  days: string | number;
  note: string | null;
  status: LeaveStatus;
  approval_request_id: string | null;
  created_at: Date | string;
}

export const toPolicy = (row: PolicyRow): LeavePolicy => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  locationId: row.location_id,
  allowanceDays: row.allowance_days === null ? null : Number(row.allowance_days),
  carryOverDays: Number(row.carry_over_days),
  needsApproval: row.needs_approval,
  archived: row.archived_at !== null,
});

export const toRequest = (row: RequestRow): LeaveRequest => ({
  id: row.id,
  userId: row.user_id,
  policyId: row.policy_id,
  kind: row.kind,
  startDate: dateOf(row.start_date),
  endDate: dateOf(row.end_date),
  halfDay: row.half_day,
  days: Number(row.days),
  note: row.note,
  status: row.status,
  approvalRequestId: row.approval_request_id,
  createdAt: iso(row.created_at),
});

export const REQUEST_COLUMNS = (sql: SqlExecutor) => sql`
  r.id, r.user_id, r.policy_id, p.kind, r.start_date, r.end_date, r.half_day, r.days, r.note,
  r.status, r.approval_request_id, r.created_at`;

export async function policyRow(sql: SqlExecutor, id: string): Promise<PolicyRow | undefined> {
  const [row] = await sql<PolicyRow[]>`select * from leave_policies where id = ${id}`;
  return row;
}

/**
 * The policies that apply at a location: one per kind, the location's own winning over the
 * one that applies everywhere.
 */
export async function policiesAt(
  sql: SqlExecutor,
  locationId: string | null,
): Promise<PolicyRow[]> {
  return sql<PolicyRow[]>`
    select distinct on (kind) * from leave_policies
    where archived_at is null and (location_id is null or location_id = ${locationId})
    order by kind, location_id nulls last`;
}
