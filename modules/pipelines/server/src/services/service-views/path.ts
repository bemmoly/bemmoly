import type { SqlExecutor } from '@bemmoly/core';
import type { ChangeRequestStatus } from '../../../../shared/change-requests.ts';
import type { ServiceChangeRef, ServiceEnvironment } from '../../../../shared/service-views.ts';
import type { PathEnvironmentRecord } from '../../models/service-views.ts';

/** The environments on the one promotion path, first to last; none is treated differently. */
export async function pathEnvironments(sql: SqlExecutor): Promise<PathEnvironmentRecord[]> {
  return sql<PathEnvironmentRecord[]>`
    select e.id, e.key, e.name, e.position,
      (e.approval_rule is not null and jsonb_array_length(coalesce(e.approval_rule -> 'steps', '[]'::jsonb)) > 0) as has_rule,
      ca.external_id as project, e.region
    from pipeline_environments e
    left join cloud_accounts ca on ca.id = e.cloud_account_id
    where e.archived_at is null
    order by e.position, e.id`;
}

export function toEnvironment(row: PathEnvironmentRecord): ServiceEnvironment {
  return {
    key: row.key,
    name: row.name,
    position: row.position,
    hasApprovalRule: row.has_rule,
    project: row.project,
    region: row.region,
  };
}

/** Open change requests are the ones a version is still on its way through. */
export const OPEN_CHANGE_STATUSES = ['waiting', 'approved', 'deploying'] as const;

/**
 * Approvals given and needed on a change request `cr`, as two columns for a lateral join:
 * every approving decision against the sum of what its steps ask for.
 */
export function changeCounts(sql: SqlExecutor) {
  return sql`
    (select count(*) from pipeline_change_request_approvals ap
      join pipeline_change_request_steps st on st.id = ap.step_id
      where st.change_request_id = cr.id and ap.decision = 'approved')::int as change_approvals,
    (select coalesce(sum(st.count), 0) from pipeline_change_request_steps st
      where st.change_request_id = cr.id)::int as change_needed`;
}

export function changeRef(row: {
  change_number: string | number | null;
  change_status: string | null;
  change_approvals: number | null;
  change_needed: number | null;
}): ServiceChangeRef | null {
  if (row.change_number === null || !row.change_status) return null;
  return {
    number: `CHG-${row.change_number}`,
    status: row.change_status as ChangeRequestStatus,
    approvals: row.change_approvals ?? 0,
    needed: row.change_needed ?? 0,
  };
}
