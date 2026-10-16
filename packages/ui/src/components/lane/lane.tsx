import type { CSSProperties } from 'react';
import { cx } from '../../lib/cx.ts';

export type LaneDotState = 'running' | 'waiting' | 'failed';

export interface LaneDot {
  id: string;
  state: LaneDotState;
  /** Where along the lane the release is, 0 (left) to 1 (right). */
  position: number;
}

export interface LaneProps {
  /** Only releases that are moving; a calm cell has none. */
  dots: readonly LaneDot[];
  /** Read instead of the dots: "3 moving, 1 failed". The dots themselves are decorative. */
  label?: string;
  /** Rewinding: the lane shows a moment in the past, so nothing drifts. */
  still?: boolean;
  className?: string;
}

const FILL: Record<LaneDotState, string> = {
  running: 'bg-prog',
  waiting: 'bg-amber',
  failed: 'bg-red',
};

/** How far a running dot travels before it eases back, as a share of the lane. */
const TRAVEL = 0.18;

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/**
 * One Release map cell's lane: a dot per release moving through it, coloured by state.
 * Running dots drift forward on the shared `drift` animation, pure CSS so a map of hundreds
 * of cells costs no script; waiting and failed dots hold still because nothing is moving
 * them. Under reduced motion, and while the map is rewound (`still`), every dot rests at its
 * position.
 */
export function Lane({ dots, label, still = false, className }: LaneProps) {
  return (
    <div className={cx('relative h-2.5 overflow-hidden rounded-full bg-line-2', className)}>
      {label && <span className="sr-only">{label}</span>}
      {dots.map((dot, index) => {
        const at = clamp(dot.position);
        const travel = dot.state === 'running' && !still ? Math.min(TRAVEL, 1 - at) : 0;
        return (
          // The layer spans the lane, so the drift's percentage is a share of the lane's width.
          <span
            key={dot.id}
            aria-hidden
            data-state={dot.state}
            className={cx('absolute inset-0', travel > 0 && 'motion-safe:animate-drift')}
            style={
              travel > 0
                ? ({
                    '--drift-x': `${(travel * 100).toFixed(1)}%`,
                    '--drift-y': '0px',
                    '--drift-period': `${5 + (index % 3)}s`,
                  } as CSSProperties)
                : undefined
            }
          >
            <span
              className={cx('absolute top-px size-2 rounded-full', FILL[dot.state])}
              style={{ left: `calc(${(at * 100).toFixed(1)}% - ${at * 8}px)` }}
            />
          </span>
        );
      })}
    </div>
  );
}
