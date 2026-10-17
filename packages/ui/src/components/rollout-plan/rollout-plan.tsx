import type { ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { RunGlyph, type RunGlyphState } from '../run-glyph/run-glyph.tsx';

export interface RolloutStep {
  key: string;
  /** "5%", "25%", "100%". */
  label: string;
  /** Once the rollout is under way: where this step has got to. */
  state?: RunGlyphState;
}

export interface RolloutWaveView {
  key: string;
  /** 1, 2, 3: the order the waves go in. */
  number: number;
  /** "asia-south1", "us-east1 and eu-west1 together". */
  title: string;
  /** Canary steps; none means straight to 100%. */
  steps?: readonly RolloutStep[];
  /** "10 minutes each, judged on error rate and p95", "30 minutes after wave 1 reaches 100%". */
  detail?: string;
}

export interface RolloutPlanProps {
  waves: readonly RolloutWaveView[];
  /** Names the list: "Rollout to Prod". */
  ariaLabel: string;
  /** The state in words for a step's glyph, when steps carry one. */
  stateLabel?: (state: RunGlyphState) => string;
  /** Under the waves: the roll back switch, the "When" choice. */
  children?: ReactNode;
  className?: string;
}

/**
 * How a release rolls across regions: numbered waves, each with its canary steps (5%, 25%,
 * 100%) and what it waits for. Before the rollout it is the plan; during it each step carries
 * its glyph, so the same drawing reads as progress.
 */
export function RolloutPlan({
  waves,
  ariaLabel,
  stateLabel,
  children,
  className,
}: RolloutPlanProps) {
  return (
    <div className={cx('flex flex-col', className)}>
      <ol aria-label={ariaLabel} className="flex flex-col">
        {waves.map((wave) => (
          <li
            key={wave.key}
            className="flex flex-col gap-1.5 border-b border-line-2 py-2.5 last:border-b-0"
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="grid size-5 shrink-0 place-items-center rounded-chip border border-line font-mono text-11 text-tx-2"
              >
                {wave.number}
              </span>
              <span className="min-w-0 truncate text-13 font-medium text-tx">{wave.title}</span>
            </span>
            {(wave.steps?.length || wave.detail) && (
              <span className="flex flex-wrap items-center gap-1.5 text-12 text-tx-2">
                {wave.steps?.map((step, index) => (
                  <span key={step.key} className="flex items-center gap-1.5">
                    {index > 0 && <Icon name="chevron" size={12} className="text-tx-3" />}
                    <span className="flex items-center gap-1 rounded-chip bg-line-2 px-1.5 py-0.5 font-mono text-11 text-tx-2">
                      {step.state && (
                        <RunGlyph
                          state={step.state}
                          size={12}
                          {...(stateLabel ? { label: stateLabel(step.state) } : {})}
                        />
                      )}
                      {step.label}
                    </span>
                  </span>
                ))}
                {wave.detail && <span className="text-tx-3">{wave.detail}</span>}
              </span>
            )}
          </li>
        ))}
      </ol>
      {children}
    </div>
  );
}
