import type { SqlExecutor } from '@bemmoly/core';
import type { ChangeKind } from '../../../../shared/changes.ts';

/*
 * How any area adds a line to What changed?: config and variables, environments, access
 * grants, policies, infrastructure. Deploys and roll backs are written by the deployment
 * record itself. Call it in the transaction that made the change.
 */

export interface ChangeInput {
  kind: ChangeKind;
  summary: string;
  detail?: string | null;
  applicationId?: string | null;
  environmentId?: string | null;
  actorUserId?: string | null;
  /** "Platform", "GitHub", when no person did it. */
  actorLabel?: string | null;
  ref?: { kind: string; id: string } | null;
  revertible?: boolean;
  occurredAt?: Date;
}

export async function recordChange(tx: SqlExecutor, input: ChangeInput): Promise<void> {
  await tx`
    insert into pipeline_changes
      (kind, application_id, environment_id, domain_id, group_id, actor_user_id, actor_label,
       summary, detail, ref_kind, ref_id, revertible, occurred_at)
    select ${input.kind}, ${input.applicationId ?? null}::uuid, ${input.environmentId ?? null}::uuid,
      a.domain_id, a.group_id, ${input.actorUserId ?? null}::uuid, ${input.actorLabel ?? null},
      ${input.summary}, ${input.detail ?? null}, ${input.ref?.kind ?? null},
      ${input.ref?.id ?? null}::uuid, ${input.revertible ?? false},
      ${(input.occurredAt ?? new Date()).toISOString()}::timestamptz
    from (select 1) one
    left join pipeline_applications a on a.id = ${input.applicationId ?? null}::uuid`;
}
