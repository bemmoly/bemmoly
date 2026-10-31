import { can, type MockDb } from '../db.ts';
import {
  leaveDays,
  type LeavePolicy,
  type LeaveRequest,
  type MockPeople,
} from '../seed/people-hr.ts';
import { newId } from '../seed/time.ts';
import { bodyOf, fail, invalid, notFound, ok, type MockRoute } from '../types.ts';
import { managerChain, peopleState, reportsOf } from './org.ts';

/* People's time off under /api/v1/hr, with requests that open an approval for the manager. */

const today = () => new Date().toISOString().slice(0, 10);

/** One policy per kind, the location's own winning over the general one. */
function policiesFor(state: MockPeople, locationId: string | null): LeavePolicy[] {
  const live = state.policies.filter(
    (p) => !p.archived && (!p.locationId || p.locationId === locationId),
  );
  const byKind = new Map<string, LeavePolicy>();
  for (const policy of live) {
    if (!byKind.has(policy.kind) || policy.locationId) byKind.set(policy.kind, policy);
  }
  return [...byKind.values()];
}

function balances(state: MockPeople, userId: string) {
  const person = state.persons.find((p) => p.userId === userId);
  if (!person) return [];
  const day = today();
  const year = Number(day.slice(0, 4));
  return policiesFor(state, person.locationId).map((policy) => {
    const mine = state.requests.filter(
      (r) =>
        r.userId === userId && r.policyId === policy.id && r.startDate.startsWith(String(year)),
    );
    const sum = (list: LeaveRequest[]) => list.reduce((total, r) => total + r.days, 0);
    const used = sum(mine.filter((r) => r.status === 'approved' && r.startDate <= day));
    const booked = sum(mine.filter((r) => r.status === 'approved' && r.startDate > day));
    const pending = sum(mine.filter((r) => r.status === 'pending'));
    const allowance = policy.allowanceDays;
    return {
      policyId: policy.id,
      name: policy.name,
      kind: policy.kind,
      year,
      allowance,
      used,
      booked,
      pending,
      left: allowance === null ? null : allowance - used - booked - pending,
    };
  });
}

/** Whose leave details the signed-in person sees: null for everyone. */
function visibleUsers(db: MockDb): Set<string> | null {
  if (can(db, 'people.leave.manage')) return null;
  const me = db.signedInAs ?? '';
  return new Set([me, ...reportsOf(peopleState(db), me, true).map((p) => p.userId)]);
}

function createRequest(db: MockDb, body: Partial<LeaveRequest>) {
  const state = peopleState(db);
  const me = state.persons.find((p) => p.userId === db.signedInAs);
  if (!me) return invalid('policyId', 'You have no person record yet; ask People to add you');
  const policy = policiesFor(state, me.locationId).find((p) => p.id === body.policyId);
  if (!policy) return invalid('policyId', 'Pick one of the leave types for your location');
  const start = body.startDate ?? today();
  const end = body.endDate ?? start;
  const days = leaveDays(start, end, body.halfDay ?? false);
  if (days === 0) return invalid('startDate', 'Those days are all weekends; pick working days');
  const clash = state.requests.some(
    (r) =>
      r.userId === me.userId &&
      ['pending', 'approved'].includes(r.status) &&
      r.startDate <= end &&
      r.endDate >= start,
  );
  if (clash) return fail(409, 'conflict', 'You already have time off on some of those days');
  const left = balances(state, me.userId).find((b) => b.policyId === policy.id)?.left;
  if (left !== null && left !== undefined && left < days) {
    return invalid('endDate', `That is ${days} days and ${left} are left this year`);
  }
  const manager = managerChain(state, me.userId)[0];
  if (policy.needsApproval && !manager) {
    return invalid('policyId', 'Nobody can approve this: you have no manager on record');
  }
  const request: LeaveRequest = {
    id: newId(),
    userId: me.userId,
    policyId: policy.id,
    kind: policy.kind,
    startDate: start,
    endDate: end,
    halfDay: body.halfDay ?? false,
    days,
    note: body.note ?? null,
    status: policy.needsApproval ? 'pending' : 'approved',
    approvalRequestId: null,
    createdAt: new Date().toISOString(),
  };
  if (policy.needsApproval && manager) {
    request.approvalRequestId = newId();
    state.approvals.push({
      id: request.approvalRequestId,
      moduleId: 'people',
      workflowKey: 'people.leave',
      workflowVersion: 1,
      subject: { kind: 'leave_request', id: request.id },
      title: `${me.name} · ${policy.name}, ${start} to ${end}`,
      url: `/people/time-off?request=${request.id}`,
      requesterId: me.userId,
      fields: { days, kind: policy.kind },
      status: 'pending',
      currentStage: 0,
      autoApproved: false,
      tasks: [
        {
          id: newId(),
          stage: 0,
          approverId: manager.userId,
          onBehalfOf: null,
          status: 'pending',
          escalation: false,
          comment: null,
          dueAt: null,
          decidedAt: null,
        },
      ],
      createdAt: request.createdAt,
      updatedAt: request.createdAt,
      closedAt: null,
    });
  }
  state.requests.push(request);
  return ok(request, 201);
}

export const peopleLeaveRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/hr/leave-policies',
    handle: (request, db) => {
      const all = request.query.get('includeArchived') === 'true';
      return ok({ items: peopleState(db).policies.filter((p) => all || !p.archived) });
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/hr/leave-policies',
    handle: (request, db) => {
      if (!can(db, 'people.settings.manage'))
        return fail(403, 'forbidden', 'Only People admins can change policies');
      const body = bodyOf<LeavePolicy>(request);
      const policy: LeavePolicy = {
        id: newId(),
        name: body.name ?? '',
        kind: body.kind ?? 'annual',
        locationId: body.locationId ?? null,
        allowanceDays: body.allowanceDays ?? null,
        carryOverDays: body.carryOverDays ?? 0,
        needsApproval: body.needsApproval ?? true,
        archived: false,
      };
      peopleState(db).policies.push(policy);
      return ok(policy, 201);
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/hr/leave-policies/:id',
    handle: (request, db) => {
      const policy = peopleState(db).policies.find((p) => p.id === request.params.id);
      if (!policy) return notFound('That policy');
      Object.assign(policy, bodyOf(request));
      return ok(policy);
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/hr/leave-requests',
    handle: (request, db) => {
      const state = peopleState(db);
      const scope = request.query.get('scope') ?? 'mine';
      const me = db.signedInAs ?? '';
      const users =
        scope === 'all'
          ? null
          : scope === 'team'
            ? new Set(reportsOf(state, me, true).map((p) => p.userId))
            : new Set([me]);
      const items = state.requests
        .filter((r) => users === null || users.has(r.userId))
        .sort((a, b) => b.startDate.localeCompare(a.startDate));
      return ok({ items });
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/hr/leave-requests',
    handle: (request, db) => createRequest(db, bodyOf<LeaveRequest>(request)),
  },
  {
    method: 'POST',
    pattern: '/api/v1/hr/leave-requests/:id/withdraw',
    handle: (request, db) => {
      const state = peopleState(db);
      const found = state.requests.find((r) => r.id === request.params.id);
      if (!found) return notFound('That request');
      if (found.userId !== db.signedInAs)
        return fail(403, 'forbidden', 'Only the person who asked can withdraw');
      found.status = 'withdrawn';
      const approval = state.approvals.find((a) => a.id === found.approvalRequestId);
      if (approval) approval.status = 'withdrawn';
      return ok(found);
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/hr/leave-balances',
    handle: (request, db) => {
      const userId = request.query.get('userId') ?? db.signedInAs ?? '';
      const allowed = visibleUsers(db);
      if (allowed && !allowed.has(userId)) {
        return fail(403, 'forbidden', 'You can see the balances of yourself and your reports only');
      }
      return ok({ items: balances(peopleState(db), userId) });
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/hr/absences',
    handle: (request, db) => {
      const state = peopleState(db);
      const from = request.query.get('from') ?? today();
      const to = request.query.get('to') ?? from;
      const teamId = request.query.get('teamId');
      const allowed = visibleUsers(db);
      const items = state.requests
        .filter(
          (r) =>
            (r.status === 'pending' || r.status === 'approved') &&
            r.startDate <= to &&
            r.endDate >= from,
        )
        .filter(
          (r) => !teamId || state.persons.find((p) => p.userId === r.userId)?.teamId === teamId,
        )
        .map((r) => ({
          requestId: r.id,
          userId: r.userId,
          startDate: r.startDate,
          endDate: r.endDate,
          halfDay: r.halfDay,
          status: r.status,
          kind: allowed === null || allowed.has(r.userId) ? r.kind : null,
        }));
      return ok({ items });
    },
  },
];
