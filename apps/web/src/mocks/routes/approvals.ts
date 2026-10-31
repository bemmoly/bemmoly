import type { ApprovalRequest } from '@bemmoly/shared/approvals';
import { type MockDb } from '../db.ts';
import { bodyOf, fail, notFound, ok, type MockRoute } from '../types.ts';
import { peopleState } from './org.ts';

/*
 * The kernel's approval engine (ADR 0051), as far as People's screens use it: what waits on
 * the signed-in person, and their decisions. Deciding settles the leave request it is for.
 */

const waitingOn = (request: ApprovalRequest, userId: string | null) =>
  (request.status === 'pending' || request.status === 'escalated') &&
  request.tasks.some((task) => task.approverId === userId && task.status === 'pending');

function settle(db: MockDb, request: ApprovalRequest) {
  const leave = peopleState(db).requests.find((item) => item.id === request.subject.id);
  if (leave && leave.status === 'pending' && request.status !== 'pending') {
    leave.status =
      request.status === 'approved'
        ? 'approved'
        : request.status === 'rejected'
          ? 'rejected'
          : 'withdrawn';
  }
}

export const approvalRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/approval-requests',
    handle: (request, db) => {
      const scope = request.query.get('scope') ?? 'waiting';
      const moduleId = request.query.get('moduleId');
      const items = peopleState(db).approvals.filter(
        (item) =>
          (!moduleId || item.moduleId === moduleId) &&
          (scope === 'mine' ? item.requesterId === db.signedInAs : waitingOn(item, db.signedInAs)),
      );
      return ok({ items, nextCursor: null });
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/approval-requests/:id',
    handle: (request, db) => {
      const found = peopleState(db).approvals.find((item) => item.id === request.params.id);
      return found ? ok(found) : notFound('That approval request');
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/approval-requests/:id/decisions',
    handle: (request, db) => {
      const found = peopleState(db).approvals.find((item) => item.id === request.params.id);
      if (!found) return notFound('That approval request');
      if (!waitingOn(found, db.signedInAs)) {
        return fail(403, 'forbidden', 'This request is not waiting on you');
      }
      const { decision, comment } = bodyOf<{ decision: 'approve' | 'reject'; comment: string }>(
        request,
      );
      const at = new Date().toISOString();
      for (const task of found.tasks) {
        if (task.approverId === db.signedInAs && task.status === 'pending') {
          Object.assign(task, {
            status: decision === 'approve' ? 'approved' : 'rejected',
            comment: comment ?? null,
            decidedAt: at,
          });
        }
      }
      Object.assign(found, {
        status: decision === 'approve' ? 'approved' : 'rejected',
        currentStage: null,
        updatedAt: at,
        closedAt: at,
      });
      settle(db, found);
      return ok(found);
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/approval-requests/:id/withdraw',
    handle: (request, db) => {
      const found = peopleState(db).approvals.find((item) => item.id === request.params.id);
      if (!found) return notFound('That approval request');
      Object.assign(found, {
        status: 'withdrawn',
        currentStage: null,
        closedAt: new Date().toISOString(),
      });
      settle(db, found);
      return ok(found);
    },
  },
];
