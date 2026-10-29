import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { ForbiddenError, ValidationError } from '@bemmoly/shared';
import type { BalancesQuery, LeaveBalance } from '../../../../shared/leave.ts';
import {
  requireDatabase,
  requireDirectory,
  requireUser,
  today,
  type PeopleServiceDeps,
} from '../common.ts';
import { policiesAt, type PolicyRow } from './rows.ts';
import type { LeaveVisibility } from './visibility.ts';

interface Totals {
  policy_id: string;
  used: string | number;
  booked: string | number;
  pending: string | number;
}

/**
 * Days per policy in a year, by where they stand on `day`: taken (approved, started), booked
 * (approved, still ahead) and waiting for approval. A request is counted in its start's year.
 */
async function totals(
  sql: SqlExecutor,
  userId: string,
  year: number,
  day: string,
): Promise<Map<string, Totals>> {
  const rows = await sql<Totals[]>`
    select policy_id,
      coalesce(sum(days) filter (where status = 'approved' and start_date <= ${day}::date), 0) as used,
      coalesce(sum(days) filter (where status = 'approved' and start_date > ${day}::date), 0) as booked,
      coalesce(sum(days) filter (where status = 'pending'), 0) as pending
    from leave_requests
    where user_id = ${userId} and extract(year from start_date) = ${year}
    group by policy_id`;
  return new Map(rows.map((row) => [row.policy_id, row]));
}

function balanceOf(policy: PolicyRow, year: number, total: Totals | undefined): LeaveBalance {
  const used = Number(total?.used ?? 0);
  const booked = Number(total?.booked ?? 0);
  const pending = Number(total?.pending ?? 0);
  const allowance = policy.allowance_days === null ? null : Number(policy.allowance_days);
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
}

/** Refuses a request that would take a limited policy below zero in its year. */
export async function checkBalance(
  sql: SqlExecutor,
  userId: string,
  policy: PolicyRow,
  startDate: string,
  days: number,
): Promise<void> {
  if (policy.allowance_days === null) return;
  const year = Number(startDate.slice(0, 4));
  const balance = balanceOf(
    policy,
    year,
    (await totals(sql, userId, year, startDate)).get(policy.id),
  );
  if ((balance.left ?? 0) < days) {
    const message = `That is ${days} days and ${balance.left} are left this year`;
    throw new ValidationError(message, { details: { issues: [{ path: 'endDate', message }] } });
  }
}

export function createLeaveBalances(deps: PeopleServiceDeps, visibility: LeaveVisibility) {
  return {
    /** A person's balances for the policies of their location; their own by default. */
    async list(ctx: RequestContext, query: BalancesQuery): Promise<LeaveBalance[]> {
      const me = requireUser(ctx);
      const userId = query.userId ?? me;
      const visible = await visibility.visibleUsers(ctx);
      if (visible && !visible.has(userId)) {
        throw new ForbiddenError('You can see the balances of yourself and your reports only');
      }
      const person = await requireDirectory(deps).get(userId);
      if (!person) return [];
      const sql = requireDatabase(deps);
      const day = today(deps);
      const year = query.year ?? Number(day.slice(0, 4));
      const [policies, byPolicy] = await Promise.all([
        policiesAt(sql, person.locationId),
        totals(sql, userId, year, day),
      ]);
      return policies.map((policy) => balanceOf(policy, year, byPolicy.get(policy.id)));
    },
  };
}

export type LeaveBalances = ReturnType<typeof createLeaveBalances>;
