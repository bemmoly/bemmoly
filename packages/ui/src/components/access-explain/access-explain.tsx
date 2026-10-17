import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { RunGlyph } from '../run-glyph/run-glyph.tsx';

export type AccessStepEffect = 'grant' | 'deny' | 'require' | 'info';

export interface AccessStep {
  key: string;
  /** "Checkout web: Developer at Checkout". */
  text: string;
  effect: AccessStepEffect;
}

export interface AccessExplainProps {
  allowed: boolean;
  /** "Allowed", "Not allowed". */
  verdict: string;
  /** "Jon is a Developer on checkout-api through Checkout web. Tier 0 to Prod needs …". */
  sentence: string;
  /** "How this was decided". */
  traceLabel: string;
  steps: readonly AccessStep[];
  /** "Ask Payments for access", or nothing when it is allowed. */
  action?: ReactNode;
  className?: string;
}

/**
 * An access decision and the chain behind it: the verdict on its signal tint, the sentence
 * that explains it, then every binding, ownership and policy step in order. The same block
 * answers the checker and "Why can't I?" wherever an action is refused.
 */
export function AccessExplain({
  allowed,
  verdict,
  sentence,
  traceLabel,
  steps,
  action,
  className,
}: AccessExplainProps) {
  return (
    <div className={cx('flex flex-col gap-3', className)}>
      <div
        role="status"
        className={cx(
          'flex flex-col gap-1 rounded-control px-3 py-2.5',
          allowed ? 'bg-green-50' : 'bg-red-50',
        )}
      >
        <span
          className={cx(
            'flex items-center gap-2 text-13 font-semibold',
            allowed ? 'text-green-tx' : 'text-red-tx',
          )}
        >
          <RunGlyph state={allowed ? 'passed' : 'failed'} size={14} />
          {verdict}
        </span>
        <span className="text-12 leading-body text-tx">{sentence}</span>
      </div>
      {steps.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-11 font-semibold text-tx-2">{traceLabel}</h3>
          <ol className="flex list-decimal flex-col gap-0.5 ps-4 text-12 leading-desc text-tx-2 marker:text-tx-3">
            {steps.map((step) => (
              <li
                key={step.key}
                data-effect={step.effect}
                className={cx(step.effect === 'deny' && 'text-red-tx')}
              >
                {step.text}
              </li>
            ))}
          </ol>
        </div>
      )}
      {action && <div className="flex">{action}</div>}
    </div>
  );
}
