import type { RequestContext } from '@bemmoly/core';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@bemmoly/shared';
import type {
  CreateLeaveRequestBody,
  LeaveRequest,
  ListLeaveRequestsQuery,
} from '../../../../shared/leave.ts';
import { leaveDays } from '../../../../shared/leave-days.ts';
import {
  authorize,
  LEAVE_CAPABILITY,
  publishChange,
  recordAudit,
  requireDatabase,
  requireDirectory,
  requireUser,
  today,
  type PeopleServiceDeps,
} from '../common.ts';
import { checkBalance } from './balances.ts';
import { policiesAt, REQUEST_COLUMNS, toRequest, type RequestRow } from './rows.ts';
import { createWorkflowEnsurer, LEAVE_SUBJECT, LEAVE_WORKFLOW_KEY } from './workflow.ts';

const invalid = (path: string, message: string) =>
  new ValidationError(message, { details: { issues: [{ path, message }] } });

/** Asking for time off, seeing requests, and taking a request back. */
export function createLeaveRequests(deps: PeopleServiceDeps) {
  const ensureWorkflow = deps.approvals ? createWorkflowEnsurer(deps.approvals) : null;

  async function byId(id: string): Promise<LeaveRequest> {
    const sql = requireDatabase(deps);
    const [row] = await sql<RequestRow[]>`
      select ${REQUEST_COLUMNS(sql)} from leave_requests r
      join leave_policies p on p.id = r.policy_id where r.id = ${id}`;
    if (!row) throw new NotFoundError('That request does not exist');
    return toRequest(row);
  }

  async function startApproval(ctx: RequestContext, request: LeaveRequest, title: string) {
    const sql = requireDatabase(deps);
    if (!deps.approvals || !ensureWorkflow) {
      throw new ValidationError('Approvals are not available, so this leave cannot be asked for');
    }
    await ensureWorkflow();
    try {
      const approval = await deps.approvals.start(ctx.actor, {
        moduleId: 'people',
        workflowKey: LEAVE_WORKFLOW_KEY,
        subject: { kind: LEAVE_SUBJECT, id: request.id },
        title,
        fields: { days: request.days, kind: request.kind },
        url: `/people/time-off?request=${request.id}`,
      });
      const status = approval.status === 'approved' ? 'approved' : request.status;
      await sql`
        update leave_requests set approval_request_id = ${approval.id}, status = ${status}
        where id = ${request.id}`;
      return { ...request, approvalRequestId: approval.id, status };
    } catch (error) {
      // The engine refused (no manager, say): the request never existed for anyone.
      await sql`delete from leave_requests where id = ${request.id}`;
      throw error;
    }
  }

  return {
    get: byId,

    async create(ctx: RequestContext, body: CreateLeaveRequestBody): Promise<LeaveRequest> {
      const me = requireUser(ctx);
      const sql = requireDatabase(deps);
      const person = await requireDirectory(deps).get(me);
      if (!person)
        throw invalid('policyId', 'You have no person record yet; ask People to add you');
      // Only the policy that applies to the person: their location's own wins over the general.
      const policy = (await policiesAt(sql, person.locationId)).find((p) => p.id === body.policyId);
      if (!policy) throw invalid('policyId', 'Pick one of the leave types for your location');
      const days = leaveDays(body.startDate, body.endDate, body.halfDay ?? false);
      if (days === 0) throw invalid('startDate', 'Those days are all weekends; pick working days');
      // One person's requests are checked and written one at a time, so two sent together
      // cannot both pass the overlap and balance checks.
      const id = await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(hashtext(${`people.leave:${me}`}))`;
        const [clash] = await tx<{ id: string }[]>`
          select id from leave_requests where user_id = ${me} and status in ('pending', 'approved')
            and start_date <= ${body.endDate} and end_date >= ${body.startDate}`;
        if (clash) throw new ConflictError('You already have time off on some of those days');
        await checkBalance(tx, me, policy, body.startDate, days);
        const [row] = await tx<{ id: string }[]>`
          insert into leave_requests (user_id, policy_id, start_date, end_date, half_day, days,
            note, status)
          values (${me}, ${policy.id}, ${body.startDate}, ${body.endDate},
            ${body.halfDay ?? false}, ${days}, ${body.note ?? null},
            ${policy.needs_approval ? 'pending' : 'approved'})
          returning id`;
        return row!.id;
      });
      let request = await byId(id);
      if (policy.needs_approval) {
        const title = `${person.name} · ${policy.name}, ${body.startDate} to ${body.endDate}`;
        request = await startApproval(ctx, request, title);
      }
      await recordAudit(deps, ctx, {
        action: 'people.leave_request.created',
        kind: 'leave_request',
        id: request.id,
        after: request,
      });
      await publishChange(deps, 'people.leave', [request.id]);
      return request;
    },

    async list(ctx: RequestContext, query: ListLeaveRequestsQuery): Promise<LeaveRequest[]> {
      const me = requireUser(ctx);
      const sql = requireDatabase(deps);
      let users: string[] | null = [me];
      if (query.scope === 'team') {
        users = (await requireDirectory(deps).reports(me, { all: true })).map((p) => p.userId);
      } else if (query.scope === 'all') {
        await authorize(ctx, LEAVE_CAPABILITY);
        users = null;
      }
      const from = query.upcoming ? today(deps) : null;
      const rows = await sql<RequestRow[]>`
        select ${REQUEST_COLUMNS(sql)} from leave_requests r
        join leave_policies p on p.id = r.policy_id
        where (${users === null} or r.user_id = any(${users ?? []}::uuid[]))
          and (${query.status ?? null}::text is null or r.status = ${query.status ?? null})
          and (${from}::date is null or r.end_date >= ${from}::date)
        order by r.start_date desc
        limit 200`;
      return rows.map(toRequest);
    },

    /**
     * The requester takes a request back: an open one through the engine, an approved one
     * only before it starts.
     */
    async withdraw(ctx: RequestContext, id: string): Promise<LeaveRequest> {
      const me = requireUser(ctx);
      const sql = requireDatabase(deps);
      const request = await byId(id);
      if (request.userId !== me) throw new ForbiddenError('Only the person who asked can withdraw');
      if (request.status === 'pending' && request.approvalRequestId && deps.approvals) {
        await deps.approvals.withdraw(ctx.actor, request.approvalRequestId);
      } else if (request.status === 'approved' && request.startDate <= today(deps)) {
        throw new ConflictError('This time off has started; ask People to change it');
      } else if (request.status !== 'pending' && request.status !== 'approved') {
        throw new ConflictError('This request is already closed');
      }
      await sql`
        update leave_requests set status = 'withdrawn', updated_at = now()
        where id = ${id} and status in ('pending', 'approved')`;
      const after = await byId(id);
      await recordAudit(deps, ctx, {
        action: 'people.leave_request.withdrawn',
        kind: 'leave_request',
        id,
        before: request,
        after,
      });
      await publishChange(deps, 'people.leave', [id]);
      return after;
    },
  };
}

export type LeaveRequests = ReturnType<typeof createLeaveRequests>;
