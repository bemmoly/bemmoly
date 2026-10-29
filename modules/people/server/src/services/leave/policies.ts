import type { RequestContext } from '@bemmoly/core';
import { ConflictError, NotFoundError } from '@bemmoly/shared';
import type {
  CreateLeavePolicyBody,
  LeavePolicy,
  UpdateLeavePolicyBody,
} from '../../../../shared/leave.ts';
import {
  authorize,
  pgCode,
  publishChange,
  recordAudit,
  requireDatabase,
  SETTINGS_CAPABILITY,
  UNIQUE_VIOLATION,
  type PeopleServiceDeps,
} from '../common.ts';
import { policyRow, toPolicy, type PolicyRow } from './rows.ts';

async function unique<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (pgCode(error) === UNIQUE_VIOLATION) {
      throw new ConflictError('That location already has a policy of this kind');
    }
    throw error;
  }
}

/** Leave policies: anyone reads them (they are the rules), People's admins change them. */
export function createLeavePolicies(deps: PeopleServiceDeps) {
  return {
    async list(options: { includeArchived?: boolean } = {}): Promise<LeavePolicy[]> {
      const sql = requireDatabase(deps);
      const all = options.includeArchived ?? false;
      const rows = await sql<PolicyRow[]>`
        select * from leave_policies where (${all} or archived_at is null)
        order by location_id nulls first, kind, name`;
      return rows.map(toPolicy);
    },

    async create(ctx: RequestContext, body: CreateLeavePolicyBody): Promise<LeavePolicy> {
      await authorize(ctx, SETTINGS_CAPABILITY);
      const sql = requireDatabase(deps);
      return unique(() =>
        sql.begin(async (tx) => {
          const [row] = await tx<PolicyRow[]>`
            insert into leave_policies (name, kind, location_id, allowance_days, carry_over_days,
              needs_approval)
            values (${body.name}, ${body.kind}, ${body.locationId ?? null},
              ${body.allowanceDays ?? null}, ${body.carryOverDays ?? 0},
              ${body.needsApproval ?? true})
            returning *`;
          const policy = toPolicy(row!);
          await recordAudit(
            deps,
            ctx,
            {
              action: 'people.leave_policy.created',
              kind: 'leave_policy',
              id: policy.id,
              after: policy,
            },
            tx,
          );
          await publishChange(deps, 'people.settings', [policy.id]);
          return policy;
        }),
      );
    },

    async update(
      ctx: RequestContext,
      id: string,
      body: UpdateLeavePolicyBody,
    ): Promise<LeavePolicy> {
      await authorize(ctx, SETTINGS_CAPABILITY);
      const sql = requireDatabase(deps);
      return unique(() =>
        sql.begin(async (tx) => {
          const before = await policyRow(tx, id);
          if (!before) throw new NotFoundError('That policy does not exist');
          const allowance =
            body.allowanceDays === undefined ? before.allowance_days : body.allowanceDays;
          const archived =
            body.archived === undefined ? before.archived_at !== null : body.archived;
          const [row] = await tx<PolicyRow[]>`
            update leave_policies set
              name = ${body.name ?? before.name},
              allowance_days = ${allowance},
              carry_over_days = ${body.carryOverDays ?? before.carry_over_days},
              needs_approval = ${body.needsApproval ?? before.needs_approval},
              archived_at = case when ${archived} then coalesce(archived_at, now()) end,
              updated_at = now()
            where id = ${id}
            returning *`;
          const policy = toPolicy(row!);
          await recordAudit(
            deps,
            ctx,
            {
              action: 'people.leave_policy.updated',
              kind: 'leave_policy',
              id,
              before: toPolicy(before),
              after: policy,
            },
            tx,
          );
          await publishChange(deps, 'people.settings', [id]);
          return policy;
        }),
      );
    },
  };
}

export type LeavePolicies = ReturnType<typeof createLeavePolicies>;
