import type { PeopleServiceDeps } from '../common.ts';
import { createAbsences } from './absences.ts';
import { createLeaveBalances } from './balances.ts';
import { createLeavePolicies } from './policies.ts';
import { createLeaveRequests } from './requests.ts';
import { createLeaveVisibility } from './visibility.ts';

export { applyOutcome, LEAVE_OUTCOME_EVENTS, LEAVE_WORKFLOW } from './workflow.ts';

/** Time off: policies, requests through the approval engine, balances and the calendar. */
export function createLeaveService(deps: PeopleServiceDeps) {
  const visibility = createLeaveVisibility(deps);
  return {
    policies: createLeavePolicies(deps),
    requests: createLeaveRequests(deps),
    balances: createLeaveBalances(deps, visibility),
    absences: createAbsences(deps, visibility),
    visibility,
  };
}

export type LeaveService = ReturnType<typeof createLeaveService>;
