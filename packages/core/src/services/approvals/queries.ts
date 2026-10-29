import { ForbiddenError } from '@bemmoly/shared';
import {
  listApprovalsQuerySchema,
  type ApprovalRequest,
  type ApprovalRequestPage,
  type ApprovalSubject,
  type ListApprovalsQuery,
} from '@bemmoly/shared/approvals';
import type { Actor } from '../../contracts/authz.ts';
import { decodeCursor, toPage } from '../../utils/keyset.ts';
import { APPROVALS_ADMIN_CAPABILITY, userIdOf, WORKSPACE, type ApprovalDeps } from './context.ts';
import { hydrate, loadRequest, toRequest, type RequestRow } from './repository.ts';

export function createQueries(deps: ApprovalDeps) {
  const { sql } = deps;

  return {
    /** The requester, anyone ever asked (or asked for), and admins may read a request. */
    async get(actor: Actor, id: string): Promise<ApprovalRequest> {
      const loaded = await loadRequest(sql, id);
      const person = userIdOf(actor);
      const involved =
        person !== null &&
        (loaded.row.requester_id === person ||
          loaded.tasks.some((t) => t.approver_id === person || t.on_behalf_of === person));
      if (!involved) await deps.authorize(actor, APPROVALS_ADMIN_CAPABILITY, WORKSPACE);
      return toRequest(loaded);
    },

    /** Newest first across every module; `waiting` is the caller's open tasks, one row each. */
    async list(actor: Actor, input: ListApprovalsQuery = {}): Promise<ApprovalRequestPage> {
      const person = userIdOf(actor);
      if (!person) throw new ForbiddenError('Approvals are listed for people');
      const query = listApprovalsQuerySchema.parse(input);
      const after = decodeCursor(query.cursor);
      const rows =
        query.scope === 'waiting'
          ? await sql<RequestRow[]>`
              select r.* from approval_requests r
              where r.status in ('pending', 'escalated')
                and exists (select 1 from approval_tasks t where t.request_id = r.id
                  and t.approver_id = ${person} and t.status = 'pending'
                  and t.stage = r.current_stage)
                ${query.moduleId ? sql`and r.module_id = ${query.moduleId}` : sql``}
                ${after ? sql`and r.id < ${after}` : sql``}
              order by r.id desc limit ${query.limit + 1}`
          : await sql<RequestRow[]>`
              select r.* from approval_requests r where r.requester_id = ${person}
                ${query.moduleId ? sql`and r.module_id = ${query.moduleId}` : sql``}
                ${after ? sql`and r.id < ${after}` : sql``}
              order by r.id desc limit ${query.limit + 1}`;
      const page = toPage(rows, query.limit);
      const items = (await hydrate(sql, page.rows)).map(toRequest);
      return { items, nextCursor: page.nextCursor };
    },

    async forSubject(moduleId: string, subject: ApprovalSubject): Promise<ApprovalRequest[]> {
      const rows = await sql<RequestRow[]>`
        select * from approval_requests where module_id = ${moduleId}
          and subject_kind = ${subject.kind} and subject_id = ${subject.id}
        order by id desc`;
      return (await hydrate(sql, rows)).map(toRequest);
    },
  };
}
