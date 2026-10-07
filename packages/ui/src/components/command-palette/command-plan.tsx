import type { ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { AiDot } from '../ai-surface/ai-parts.tsx';
import { Button } from '../button/button.tsx';

export interface PlanStep {
  /** Issue key or "both". */
  target: string;
  change: ReactNode;
  field: ReactNode;
  allowed: boolean;
}

export interface CommandPlanProps {
  /** The plan in one sentence, in the first person of the person asking. */
  summary: ReactNode;
  steps: readonly PlanStep[];
  onRun: () => void;
  onEdit?: () => void;
  running?: boolean;
  /** The note at the right of the actions. */
  footnote?: ReactNode;
}

const COLUMNS = { gridTemplateColumns: '90px minmax(0,1fr) 150px 90px' };

/**
 * The AI plan of the Command mock: nothing runs until the person confirms. Each step says
 * whether their permissions allow it. Runs only the allowed steps.
 */
export function CommandPlan({
  summary,
  steps,
  onRun,
  onEdit,
  running,
  footnote = 'Uses your permissions. Logged in the audit trail.',
}: CommandPlanProps) {
  const allowed = steps.filter((step) => step.allowed).length;
  return (
    <section
      aria-label="Plan"
      className="flex flex-col gap-3 border-b border-br2 bg-ai-bg px-4 py-3.5"
    >
      <div className="flex items-center gap-2 text-12h font-semibold text-ai">
        <AiDot />
        Plan
        <span className="font-normal text-ai-mute">nothing happens until you confirm</span>
      </div>
      <div className="text-13h leading-brief text-tx">{summary}</div>
      <div
        role="table"
        aria-label="Plan steps"
        className="overflow-hidden rounded-panel border border-ai-br2 bg-sf text-12h"
      >
        <div
          role="row"
          style={COLUMNS}
          className="grid gap-2.5 border-b border-br2 bg-sf2 px-3 py-1.75 text-11 font-medium tracking-caps text-tx5 uppercase"
        >
          <span role="columnheader">Issue</span>
          <span role="columnheader">Change</span>
          <span role="columnheader">Field</span>
          <span role="columnheader">
            <span className="sr-only">Permission</span>
          </span>
        </div>
        {steps.map((step, index) => (
          <div
            key={index}
            role="row"
            style={COLUMNS}
            className="grid items-center gap-2.5 border-b border-br-row px-3 py-2.25 last:border-b-0"
          >
            <span role="cell" className="font-mono text-11h font-medium text-tx4">
              {step.target}
            </span>
            <span role="cell">{step.change}</span>
            <span role="cell" className="text-tx3">
              {step.field}
            </span>
            <span
              role="cell"
              className={cx(
                'text-right text-11 font-semibold',
                step.allowed ? 'text-ok-fg' : 'text-danger',
              )}
            >
              {step.allowed ? 'ALLOWED' : 'DENIED'}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          loading={running ?? false}
          disabled={allowed === 0}
          onClick={onRun}
          iconEnd={<Icon name="enter" className="ml-0.5 opacity-75" />}
        >
          Run {allowed} {allowed === 1 ? 'change' : 'changes'}
        </Button>
        {onEdit && <Button onClick={onEdit}>Edit plan</Button>}
        <span className="ml-auto text-12 text-tx5">{footnote}</span>
      </div>
    </section>
  );
}
