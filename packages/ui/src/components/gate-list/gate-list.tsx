import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { RunGlyph, type RunGlyphState } from '../run-glyph/run-glyph.tsx';

/** A fact that is not known yet is pending with its reason, never a pass. */
export type GateState = 'pass' | 'fail' | 'pending';

export interface GateItem {
  key: string;
  state: GateState;
  /** "Healthy in Staging". */
  label: string;
  /** "31 minutes, needs 30": why it is in that state, in plain words. */
  reason?: string;
  /** More under the reason: the approvers so far, a link to the failing check. */
  children?: ReactNode;
}

export interface GateListProps {
  gates: readonly GateItem[];
  /** Names the list: "Gates for Prod". */
  ariaLabel: string;
  /** The state in words for assistive tech, in the person's language. */
  stateLabel: (state: GateState) => string;
  className?: string;
}

const GLYPH: Record<GateState, RunGlyphState> = {
  pass: 'passed',
  fail: 'failed',
  pending: 'waiting',
};

/**
 * The checks a promotion must meet, each with its state and the reason for it, so the person
 * asking and the person approving read the same evidence. A failing gate's label turns red
 * text; nothing else is coloured beyond the glyph.
 */
export function GateList({ gates, ariaLabel, stateLabel, className }: GateListProps) {
  return (
    <ul aria-label={ariaLabel} className={cx('flex flex-col', className)}>
      {gates.map((gate) => (
        <li key={gate.key} data-state={gate.state} className="flex items-start gap-2.5 py-1.75">
          <RunGlyph state={GLYPH[gate.state]} size={14} className="mt-0.5 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span
              className={cx(
                'text-13 leading-card font-medium',
                gate.state === 'fail' ? 'text-red-tx' : 'text-tx',
              )}
            >
              {gate.label}
              <span className="sr-only">, {stateLabel(gate.state)}</span>
            </span>
            {gate.reason && <span className="text-12 text-tx-3">{gate.reason}</span>}
            {gate.children}
          </div>
        </li>
      ))}
    </ul>
  );
}
