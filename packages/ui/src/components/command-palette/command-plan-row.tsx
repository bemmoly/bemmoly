import type { ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { Checkbox } from '../checkbox/checkbox.tsx';
import { Spinner } from '../spinner/spinner.tsx';

/** A step's life, as the plans API reports it. */
export type PlanStepStatus =
  'proposed' | 'pending' | 'skipped' | 'running' | 'done' | 'failed' | 'undone';

export interface PlanStep {
  /** Stable per step; the edit checkboxes report it. Defaults to the row's index. */
  id?: string | number;
  /** Issue key, a space key, or "both" when one change covers several records. */
  target: string;
  change: ReactNode;
  field: ReactNode;
  allowed: boolean;
  /** Why the person's permissions refuse it, in plain words. */
  reason?: string | null;
  status?: PlanStepStatus;
  /** Why it failed while running, in plain words. */
  error?: string | null;
}

/*
 * Issue, change, field, status. On a phone the field moves under the change and the columns
 * narrow, so the table never scrolls sideways.
 */
export const PLAN_GRID =
  'grid gap-2.5 grid-cols-[56px_minmax(0,1fr)_76px] sm:grid-cols-[90px_minmax(0,1fr)_150px_90px]';

function StatusCell({ step }: { step: PlanStep }) {
  const status = step.status ?? 'proposed';
  const base = 'inline-flex items-center justify-end gap-1 text-right text-11 font-semibold';
  if (status === 'proposed') {
    return step.allowed ? (
      <span className={cx(base, 'text-green-tx')}>Allowed</span>
    ) : (
      <span className={cx(base, 'text-red')} title={step.reason ?? undefined}>
        Denied
      </span>
    );
  }
  if (status === 'running') {
    return (
      <span className={cx(base, 'text-ai-600')}>
        <Spinner size={11} />
        Running
      </span>
    );
  }
  if (status === 'done') {
    return (
      <span className={cx(base, 'text-green-tx')}>
        <Icon name="check" size={12} />
        Done
      </span>
    );
  }
  if (status === 'failed') return <span className={cx(base, 'text-red')}>Failed</span>;
  const words = { pending: 'Waiting', skipped: 'Left out', undone: 'Undone' } as const;
  return <span className={cx(base, 'font-medium text-tx-3')}>{words[status]}</span>;
}

export interface CommandPlanRowProps {
  step: PlanStep;
  /** Edit mode: allowed rows get a checkbox; denied rows stay out. */
  editing?: boolean;
  kept?: boolean;
  onToggle?: () => void;
}

export function CommandPlanRow({ step, editing, kept, onToggle }: CommandPlanRowProps) {
  const left = step.status === 'skipped' || step.status === 'undone' || (editing && !kept);
  const note = step.status === 'failed' ? step.error : !step.allowed ? step.reason : null;
  return (
    <div
      role="row"
      className={cx(
        PLAN_GRID,
        'items-center border-b border-line-2 px-3 py-2.25 last:border-b-0',
        left && 'text-tx-3',
      )}
    >
      <span role="cell" className="flex min-w-0 items-center gap-2">
        {editing && step.allowed && (
          <Checkbox
            checked={kept ?? false}
            onChange={onToggle}
            aria-label={`Keep the change to ${step.target}`}
          />
        )}
        <span className="truncate font-mono text-12 font-medium text-tx-3">{step.target}</span>
      </span>
      <span role="cell" className="flex min-w-0 flex-col gap-0.5">
        <span className={cx('min-w-0 break-words', left && 'line-through decoration-tx-3')}>
          {step.change}
        </span>
        <span className="text-12 text-tx-2 sm:hidden">{step.field}</span>
        {note && (
          <span className={cx('text-12', step.status === 'failed' ? 'text-red' : 'text-tx-3')}>
            {note}
          </span>
        )}
      </span>
      <span role="cell" className="hidden text-tx-2 sm:block">
        {step.field}
      </span>
      <span role="cell" className="flex justify-end">
        <StatusCell step={step} />
      </span>
    </div>
  );
}
