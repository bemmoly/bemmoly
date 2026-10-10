import type { AiPlan, AiPlanStep } from '@bemmoly/shared';
import type { CommandPlanState, PlanStep, PlanStepStatus } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';

/** A row of the plan table: one step, or the same note posted on several records. */
export interface PlanRow extends PlanStep {
  id: number;
  indexes: number[];
}

/** The row's status when it stands for several steps: the least finished one leads. */
const ORDER: PlanStepStatus[] = [
  'failed',
  'running',
  'pending',
  'proposed',
  'done',
  'undone',
  'skipped',
];

function sameNote(a: AiPlanStep, b: AiPlanStep) {
  return (
    a.preview.field === 'Comment' &&
    a.tool === b.tool &&
    a.preview.change === b.preview.change &&
    a.permission === b.permission
  );
}

function fieldOf(step: AiPlanStep) {
  const { from, to, field } = step.preview;
  if (to === null) return field ?? '';
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {from && <span>{from}</span>}
      <Icon name="arrow" size={12} label="to" />
      <b className="font-semibold">{to}</b>
    </span>
  );
}

/**
 * The plan's steps as the table shows them, as the Command mock draws them: one note posted on
 * both issues is one row ("both"), and a comment reads as it will be signed.
 */
export function planRows(plan: AiPlan, you: string): PlanRow[] {
  const rows: PlanRow[] = [];
  const groups: AiPlanStep[][] = [];
  for (const step of plan.steps) {
    const group = groups.find((each) => each[0] && sameNote(each[0], step));
    if (group) group.push(step);
    else groups.push([step]);
  }
  for (const group of groups) {
    const first = group[0]!;
    const status = ORDER.find((candidate) => group.some((step) => step.status === candidate));
    const comment = first.preview.field === 'Comment';
    rows.push({
      id: first.index,
      indexes: group.map((step) => step.index),
      target:
        group.length === 1
          ? first.preview.target
          : group.length === 2
            ? 'both'
            : `${group.length} records`,
      change: comment ? (
        <span className="text-tx-2">
          Comment: “{first.preview.change} — via Bemmoly for {you}”
        </span>
      ) : (
        first.preview.change
      ),
      field: fieldOf(first),
      allowed: first.permission === 'ALLOWED',
      reason: first.reason,
      ...(status ? { status } : {}),
      error: group.find((step) => step.error)?.error ?? null,
    });
  }
  return rows;
}

export function planState(plan: AiPlan): CommandPlanState {
  switch (plan.status) {
    case 'proposed':
      return plan.runnable ? 'ready' : 'preview';
    case 'approved':
    case 'running':
      return 'running';
    default:
      return plan.status;
  }
}
