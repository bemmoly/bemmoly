import { ValidationError } from '@bemmoly/shared';
import type { ApprovalStatus, ApproverRule, WorkflowSpec } from '@bemmoly/shared/approvals';
import type { SqlExecutor } from '../../contracts/sql.ts';
import { allHold } from './conditions.ts';
import { APPROVAL_ESCALATE_JOB, nowOf, type ApprovalDeps } from './context.ts';
import type { Effects } from './effects.ts';
import type { RequestRow } from './repository.ts';

export interface Assignee {
  approverId: string;
  onBehalfOf: string | null;
}

/**
 * Rules to people: the requester never approves their own request, deactivated people are
 * left out, and someone with a delegation running now is replaced by their delegate, one hop.
 */
export async function resolveAssignees(
  deps: ApprovalDeps,
  tx: SqlExecutor,
  rules: readonly ApproverRule[],
  row: RequestRow,
): Promise<Assignee[]> {
  const context = {
    requesterId: row.requester_id,
    moduleId: row.module_id,
    subject: { kind: row.subject_kind, id: row.subject_id },
    fields: row.fields,
  };
  const resolved = (
    await Promise.all(rules.map((rule) => deps.resolver.resolve(rule, context, tx)))
  )
    .flat()
    .filter((id) => id !== row.requester_id);
  const ids = [...new Set(resolved)];
  if (ids.length === 0) return [];
  const now = nowOf(deps);
  const delegations = await tx<{ user_id: string; delegate_id: string }[]>`
    select user_id, delegate_id from approval_delegations
    where user_id = any(${ids}) and starts_at <= ${now.toISOString()} and ends_at > ${now.toISOString()}`;
  const delegateOf = new Map(delegations.map((d) => [d.user_id, d.delegate_id]));
  const everyone = [...new Set([...ids, ...delegateOf.values()])];
  const active = new Set(
    (
      await tx<{ id: string }[]>`
        select id from users where id = any(${everyone}) and status = 'active'`
    ).map((user) => user.id),
  );
  // One task per required approver: a delegate who is already on the stage, or already
  // stands in for someone else, would merge two required approvals into one.
  const assignees = new Map<string, Assignee>();
  for (const id of ids) {
    if (!active.has(id) && !delegateOf.has(id)) continue;
    const delegate = delegateOf.get(id);
    const usable =
      delegate &&
      delegate !== row.requester_id &&
      active.has(delegate) &&
      !ids.includes(delegate) &&
      !assignees.has(delegate);
    if (usable) assignees.set(delegate, { approverId: delegate, onBehalfOf: id });
    else if (active.has(id)) assignees.set(id, { approverId: id, onBehalfOf: null });
  }
  return [...assignees.values()];
}

/** Adds tasks to a stage and queues each one's escalation for when its SLA passes. */
export async function assign(
  deps: ApprovalDeps,
  tx: SqlExecutor,
  row: RequestRow,
  stage: number,
  assignees: readonly Assignee[],
  options: { dueAt: Date | null; escalation: boolean },
): Promise<void> {
  for (const assignee of assignees) {
    const [task] = await tx<{ id: string }[]>`
      insert into approval_tasks (request_id, stage, approver_id, on_behalf_of, escalation, due_at)
      values (${row.id}, ${stage}, ${assignee.approverId}, ${assignee.onBehalfOf},
        ${options.escalation}, ${options.dueAt?.toISOString() ?? null})
      returning id`;
    if (options.dueAt) {
      await deps.jobs.enqueue(
        APPROVAL_ESCALATE_JOB,
        { taskId: task!.id },
        {
          key: `approval.escalate:${task!.id}`,
          singleton: true,
          startAfter: options.dueAt,
          transaction: tx,
        },
      );
    }
  }
}

/** Closes a request: its open tasks are cancelled and it leaves every "waiting" list. */
export async function close(
  deps: ApprovalDeps,
  tx: SqlExecutor,
  row: RequestRow,
  status: Extract<ApprovalStatus, 'approved' | 'rejected' | 'withdrawn'>,
  autoApproved = false,
): Promise<RequestRow> {
  const now = nowOf(deps);
  await tx`
    update approval_tasks set status = 'cancelled', updated_at = ${now.toISOString()}
    where request_id = ${row.id} and status = 'pending'`;
  const [closed] = await tx<RequestRow[]>`
    update approval_requests set status = ${status}, current_stage = null,
      auto_approved = ${autoApproved}, closed_at = ${now.toISOString()}, updated_at = ${now.toISOString()}
    where id = ${row.id} returning *`;
  return closed!;
}

/**
 * Starts the first stage at or after `from` whose conditions hold, or approves the request
 * when none is left. A stage nobody can approve is refused, so no request waits on no one.
 */
export async function openStage(
  deps: ApprovalDeps,
  tx: SqlExecutor,
  fx: Effects,
  row: RequestRow,
  spec: WorkflowSpec,
  from: number,
): Promise<RequestRow> {
  for (let index = from; index < spec.stages.length; index += 1) {
    const stage = spec.stages[index]!;
    if (!allHold(stage.when, row.fields)) continue;
    const assignees = await resolveAssignees(deps, tx, stage.approvers, row);
    if (assignees.length === 0) {
      throw new ValidationError(`No one can approve the stage "${stage.name}"`, {
        details: { stage: index, reason: 'no_approvers' },
      });
    }
    const now = nowOf(deps);
    const dueAt = stage.sla ? new Date(now.getTime() + stage.sla.hours * 3_600_000) : null;
    await assign(deps, tx, row, index, assignees, { dueAt, escalation: false });
    const [opened] = await tx<RequestRow[]>`
      update approval_requests set status = 'pending', current_stage = ${index}, updated_at = ${now.toISOString()}
      where id = ${row.id} returning *`;
    await fx.askApprovers(
      opened!,
      assignees.map((a) => a.approverId),
      index,
    );
    await fx.emit('approval.stage_started', opened!);
    return opened!;
  }
  const approved = await close(deps, tx, row, 'approved');
  await fx.audit('approval.approved', approved);
  await fx.emit('approval.approved', approved);
  await fx.tellRequester(approved, 'approve');
  return approved;
}
