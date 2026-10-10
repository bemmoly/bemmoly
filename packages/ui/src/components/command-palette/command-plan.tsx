import type { ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { AiDot, AiNotUseful } from '../ai-surface/ai-parts.tsx';
import { Button } from '../button/button.tsx';
import { ProgressBar } from '../progress-bar/progress-bar.tsx';
import { CommandPlanRow, PLAN_GRID, type PlanStep } from './command-plan-row.tsx';

export type { PlanStep, PlanStepStatus } from './command-plan-row.tsx';

/**
 * Where the plan is: drawn up and waiting (`ready`), drawn up but never runnable (`preview`,
 * AI actions off), `running`, or finished: `done`, `failed` (a step failed) or `cancelled`.
 */
export type CommandPlanState = 'ready' | 'preview' | 'running' | 'done' | 'failed' | 'cancelled';

export interface CommandPlanProps {
  /** The plan in one sentence, in the first person of the person asking. */
  summary: ReactNode;
  steps: readonly PlanStep[];
  state?: CommandPlanState;
  onRun?: () => void;
  /** Edit plan: choose which allowed steps to keep. */
  onEdit?: () => void;
  editing?: boolean;
  /** The ids of the steps kept while editing. */
  kept?: ReadonlySet<string | number>;
  onToggle?: (id: string | number) => void;
  onStop?: () => void;
  /** Puts back what ran; shown once something ran that can be undone. */
  onUndo?: () => void;
  onNotUseful?: () => void;
  /** A request is in flight (run, stop or undo): its button shows progress. */
  busy?: boolean;
  /** The note at the right of the actions. */
  footnote?: ReactNode;
}

const idOf = (step: PlanStep, index: number) => step.id ?? index;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function heading(state: CommandPlanState, steps: readonly PlanStep[]) {
  const chosen = steps.filter((step) => !['proposed', 'skipped'].includes(step.status ?? ''));
  const made = chosen.filter((step) => step.status === 'done').length;
  const failed = chosen.filter((step) => step.status === 'failed').length;
  switch (state) {
    case 'ready':
      return ['Plan', 'nothing happens until you confirm'];
    case 'preview':
      return ['Preview only', 'AI actions that change data are turned off'];
    case 'running':
      return ['Running', `${made} of ${plural(chosen.length, 'change')} made`];
    case 'done':
      return ['Done', `${plural(made, 'change')} made`];
    case 'failed':
      return ['Finished', `${made} of ${chosen.length} made, ${failed} failed`];
    case 'cancelled':
      return [
        'Stopped',
        `${made} of ${plural(chosen.length, 'change')} made before you stopped it`,
      ];
  }
}

/**
 * The AI plan of the Command mock: nothing runs until the person confirms, each step says
 * whether their permissions allow it, and only the allowed steps they keep run. While it runs
 * each row shows its progress; after, Undo puts back what can be put back.
 */
export function CommandPlan({
  summary,
  steps,
  state = 'ready',
  onRun,
  onEdit,
  editing = false,
  kept,
  onToggle,
  onStop,
  onUndo,
  onNotUseful,
  busy = false,
  footnote,
}: CommandPlanProps) {
  const allowed = steps.filter((step) => step.allowed);
  const runnable = editing
    ? allowed.filter((step) => kept?.has(idOf(step, steps.indexOf(step)))).length
    : allowed.length;
  const denied = steps.length - allowed.length;
  const [title, detail] = heading(state, steps);
  const chosen = steps.filter((step) => !['proposed', 'skipped'].includes(step.status ?? ''));
  const finished = chosen.filter((step) => ['done', 'failed'].includes(step.status ?? ''));
  const note =
    footnote ??
    (state === 'ready' && denied > 0
      ? `${plural(denied, "change you can't make", "changes you can't make")} will be left out.`
      : state === 'ready' || state === 'running'
        ? 'Uses your permissions. Logged in the audit trail.'
        : 'Logged in the audit trail.');
  return (
    <section
      aria-label="Plan"
      aria-busy={state === 'running' || undefined}
      className="flex flex-col gap-3 border-b border-line-2 bg-ai-50 px-4 py-3.5"
    >
      <div className="flex items-center gap-2 text-13 font-semibold text-ai-600">
        <AiDot />
        {title}
        <span className="font-normal text-ai-600" aria-live="polite">
          {detail}
        </span>
      </div>
      <div className="text-13 leading-brief text-tx">{summary}</div>
      {steps.length > 0 && (
        <div
          role="table"
          aria-label="Plan steps"
          className="overflow-hidden rounded-control border border-ai-100 bg-card text-13"
        >
          <div
            role="row"
            className={`${PLAN_GRID} border-b border-line-2 bg-side px-3 py-1.75 text-11 font-semibold text-tx-3`}
          >
            <span role="columnheader">Issue</span>
            <span role="columnheader">Change</span>
            <span role="columnheader" className="hidden sm:block">
              Field
            </span>
            <span role="columnheader">
              <span className="sr-only">Permission</span>
            </span>
          </div>
          {steps.map((step, index) => {
            const id = idOf(step, index);
            return (
              <CommandPlanRow
                key={id}
                step={step}
                editing={editing && state === 'ready'}
                kept={kept?.has(id) ?? true}
                onToggle={() => onToggle?.(id)}
              />
            );
          })}
        </div>
      )}
      {state === 'running' && (
        <ProgressBar
          label="Plan progress"
          value={chosen.length ? (finished.length / chosen.length) * 100 : 0}
          fillClassName="bg-ai"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {state === 'ready' && onRun && (
          <Button
            variant="primary"
            loading={busy}
            disabled={runnable === 0}
            onClick={onRun}
            iconEnd={<Icon name="enter" className="ml-0.5 opacity-75" />}
          >
            Run {plural(runnable, 'change')}
          </Button>
        )}
        {state === 'ready' && onEdit && (
          <Button onClick={onEdit} aria-pressed={editing}>
            {editing ? 'Done editing' : 'Edit plan'}
          </Button>
        )}
        {state === 'running' && onStop && (
          <Button onClick={onStop} loading={busy}>
            Stop
          </Button>
        )}
        {['done', 'failed', 'cancelled'].includes(state) && onUndo && (
          <Button onClick={onUndo} loading={busy} icon={<Icon name="undo" size={14} />}>
            Undo
          </Button>
        )}
        {onNotUseful && state !== 'running' && <AiNotUseful onClick={onNotUseful} />}
        <span className="ml-auto text-12 text-tx-3">{note}</span>
      </div>
    </section>
  );
}
