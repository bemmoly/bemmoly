import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { RunGlyph, type RunGlyphState } from '../run-glyph/run-glyph.tsx';

/** todo: not reached; current: the one to do now; working: under way; done; failed. */
export type ProvisionState = 'todo' | 'current' | 'working' | 'done' | 'failed';

export interface ProvisionStep {
  key: string;
  /** "Scan GitHub", "Create acme-commerce-prod". */
  title: string;
  /** What it does, or what happened: "Finds Dockerfiles, Helm charts and CODEOWNERS". */
  description?: string;
  state: ProvisionState;
  /** The step's button; shown on the current and failed steps. */
  action?: ReactNode;
}

export interface ProvisionChecklistProps {
  steps: readonly ProvisionStep[];
  ariaLabel: string;
  /** The state in words for assistive tech. */
  stateLabel: (state: ProvisionState) => string;
  className?: string;
}

/** The current step draws its number instead; its glyph is only the fallback. */
const GLYPH: Record<ProvisionState, RunGlyphState> = {
  todo: 'queued',
  current: 'queued',
  working: 'running',
  done: 'passed',
  failed: 'failed',
};

/**
 * Ordered steps toward something working: the first run of an empty install (scan GitHub,
 * connect a cloud, ship a first application) and the landing zone being created. Done steps
 * go quiet, the current one is raised with its action, and a failed one keeps its action so it
 * can be tried again.
 */
export function ProvisionChecklist({
  steps,
  ariaLabel,
  stateLabel,
  className,
}: ProvisionChecklistProps) {
  return (
    <ol aria-label={ariaLabel} className={cx('flex flex-col gap-1', className)}>
      {steps.map((step, index) => {
        const current = step.state === 'current';
        return (
          <li
            key={step.key}
            aria-current={current ? 'step' : undefined}
            data-state={step.state}
            className={cx(
              'flex items-start gap-3 rounded-control px-3 py-2.5',
              current && 'bg-acc-50',
            )}
          >
            {current ? (
              <span
                aria-hidden
                className="mt-px grid size-4 shrink-0 place-items-center rounded-full bg-acc-fill font-mono text-11 font-semibold text-on-acc"
              >
                {index + 1}
              </span>
            ) : (
              <RunGlyph state={GLYPH[step.state]} size={16} className="mt-px shrink-0" />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span
                className={cx(
                  'text-13 font-medium',
                  step.state === 'done' ? 'text-tx-2' : 'text-tx',
                  step.state === 'failed' && 'text-red-tx',
                )}
              >
                {step.title}
                <span className="sr-only">, {stateLabel(step.state)}</span>
              </span>
              {step.description && (
                <span className="text-12 leading-body text-tx-3">{step.description}</span>
              )}
            </div>
            {(current || step.state === 'failed') && step.action && (
              <div className="shrink-0">{step.action}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
