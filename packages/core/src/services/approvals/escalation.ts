import type { SqlExecutor } from '../../contracts/sql.ts';
import { ESCALATION_ACTOR, nowOf, type ApprovalDeps } from './context.ts';
import { effectsFor } from './effects.ts';
import { isOpen, loadRequest, type RequestRow, type TaskRow } from './repository.ts';
import { assign, resolveAssignees } from './stages.ts';

/**
 * A task's SLA passed. If the task is still waiting on the stage that is still current, the
 * request is marked escalated and the stage's escalation rule is asked as well; the first
 * overdue task of a stage does this once, later ones find the request already escalated.
 */
export async function escalateTask(deps: ApprovalDeps, taskId: string): Promise<void> {
  await deps.sql.begin(async (tx) => {
    const [task] = await tx<TaskRow[]>`select * from approval_tasks where id = ${taskId}`;
    if (!task || task.status !== 'pending') return;
    const { row, spec, tasks } = await loadRequest(tx, task.request_id, true);
    if (!isOpen(row.status) || row.status === 'escalated' || row.current_stage !== task.stage) {
      return;
    }
    const [escalated] = await tx<RequestRow[]>`
      update approval_requests set status = 'escalated', updated_at = ${nowOf(deps).toISOString()}
      where id = ${row.id} returning *`;
    const fx = effectsFor(deps, ESCALATION_ACTOR, tx);
    const asked = await askEscalation(
      deps,
      tx,
      escalated!,
      spec.stages[task.stage]?.sla?.escalateTo,
      tasks,
    );
    await fx.audit('approval.escalated', escalated!, {
      status: 'escalated',
      stage: task.stage,
      overdueTaskId: task.id,
      asked,
    });
    await fx.emit('approval.escalated', escalated!);
    await fx.askApprovers(escalated!, asked, task.stage);
  });
}

async function askEscalation(
  deps: ApprovalDeps,
  tx: SqlExecutor,
  row: RequestRow,
  rule: Parameters<typeof resolveAssignees>[2][number] | undefined,
  tasks: readonly TaskRow[],
): Promise<string[]> {
  if (!rule || row.current_stage === null) return [];
  const waiting = new Set(
    tasks
      .filter((t) => t.stage === row.current_stage && t.status === 'pending')
      .map((t) => t.approver_id),
  );
  const fresh = (await resolveAssignees(deps, tx, [rule], row)).filter(
    (a) => !waiting.has(a.approverId),
  );
  await assign(deps, tx, row, row.current_stage, fresh, { dueAt: null, escalation: true });
  return fresh.map((a) => a.approverId);
}
