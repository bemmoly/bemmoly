import type { RequestContext } from '@bemmoly/core';
import type { Absence, AbsencesQuery, LeaveKind } from '../../../../shared/leave.ts';
import { dateOf, requireDatabase, requireDirectory, type PeopleServiceDeps } from '../common.ts';
import type { LeaveVisibility } from './visibility.ts';

interface AbsenceRow {
  id: string;
  user_id: string;
  start_date: Date | string;
  end_date: Date | string;
  half_day: boolean;
  status: 'pending' | 'approved';
  kind: LeaveKind;
}

/** The team calendar and "who's out": anyone signed in sees who is away, not always why. */
export function createAbsences(deps: PeopleServiceDeps, visibility: LeaveVisibility) {
  return {
    async list(ctx: RequestContext, query: AbsencesQuery): Promise<Absence[]> {
      const sql = requireDatabase(deps);
      const team = query.teamId
        ? (await requireDirectory(deps).list({ teamId: query.teamId })).map((p) => p.userId)
        : null;
      const rows = await sql<AbsenceRow[]>`
        select r.id, r.user_id, r.start_date, r.end_date, r.half_day, r.status, p.kind
        from leave_requests r join leave_policies p on p.id = r.policy_id
        where r.status in ('pending', 'approved')
          and r.start_date <= ${query.to}::date and r.end_date >= ${query.from}::date
          and (${team === null} or r.user_id = any(${team ?? []}::uuid[]))
        order by r.start_date, r.user_id
        limit 1000`;
      const visible = await visibility.visibleUsers(ctx);
      return rows.map((row) => ({
        requestId: row.id,
        userId: row.user_id,
        startDate: dateOf(row.start_date),
        endDate: dateOf(row.end_date),
        halfDay: row.half_day,
        status: row.status,
        kind: visible === null || visible.has(row.user_id) ? row.kind : null,
      }));
    },
  };
}

export type Absences = ReturnType<typeof createAbsences>;
