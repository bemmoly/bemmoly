import { ForbiddenError, ValidationError } from '@bemmoly/shared';
import {
  delegationBodySchema,
  type ApprovalDelegation,
  type DelegationBody,
} from '@bemmoly/shared/approvals';
import type { Actor } from '../../contracts/authz.ts';
import { userIdOf, type ApprovalDeps } from './context.ts';

interface DelegationRow {
  delegate_id: string;
  starts_at: Date | string;
  ends_at: Date | string;
}

const toDelegation = (row: DelegationRow): ApprovalDelegation => ({
  delegateId: row.delegate_id,
  startsAt: new Date(row.starts_at).toISOString(),
  endsAt: new Date(row.ends_at).toISOString(),
});

function personOf(actor: Actor): string {
  const id = userIdOf(actor);
  if (!id) throw new ForbiddenError('Delegations belong to people');
  return id;
}

/**
 * A person's one delegate while away. It applies to stages that start inside the period;
 * tasks already handed out stay with whoever has them.
 */
export function createDelegations(deps: ApprovalDeps) {
  const { sql } = deps;
  const target = (id: string) => ({ kind: 'approval_delegation', id });

  return {
    async get(actor: Actor): Promise<ApprovalDelegation | null> {
      const [row] = await sql<DelegationRow[]>`
        select delegate_id, starts_at, ends_at from approval_delegations
        where user_id = ${personOf(actor)}`;
      return row ? toDelegation(row) : null;
    },

    async set(actor: Actor, input: DelegationBody): Promise<ApprovalDelegation> {
      const userId = personOf(actor);
      const body = delegationBodySchema.parse(input);
      if (body.delegateId === userId) throw new ValidationError('Pick someone other than yourself');
      const [delegate] = await sql<{ id: string }[]>`
        select id from users where id = ${body.delegateId} and status = 'active'`;
      if (!delegate) throw new ValidationError('The delegate must be an active person');
      const row = await sql.begin(async (tx) => {
        const [saved] = await tx<DelegationRow[]>`
          insert into approval_delegations (user_id, delegate_id, starts_at, ends_at)
          values (${userId}, ${body.delegateId}, ${body.startsAt.toISOString()}, ${body.endsAt.toISOString()})
          on conflict (user_id) do update set delegate_id = excluded.delegate_id,
            starts_at = excluded.starts_at, ends_at = excluded.ends_at, updated_at = now()
          returning delegate_id, starts_at, ends_at`;
        await deps.audit.record(
          {
            actor,
            action: 'approval_delegation.set',
            target: target(userId),
            after: toDelegation(saved!),
          },
          tx,
        );
        return saved!;
      });
      return toDelegation(row as DelegationRow);
    },

    async clear(actor: Actor): Promise<void> {
      const userId = personOf(actor);
      await sql.begin(async (tx) => {
        const removed = await tx`delete from approval_delegations where user_id = ${userId}`;
        if (removed.count === 0) return;
        await deps.audit.record(
          { actor, action: 'approval_delegation.cleared', target: target(userId) },
          tx,
        );
      });
    },
  };
}
