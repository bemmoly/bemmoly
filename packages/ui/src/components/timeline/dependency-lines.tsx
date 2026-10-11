import { useId } from 'react';
import { cx } from '../../lib/cx.ts';

/*
 * The roadmap's dependencies: a line from the end of the blocking bar to the start of the
 * waiting one, stepping down between rows, with a small arrowhead. Quiet ink when the plan
 * holds, amber when the waiting item is planned to start before its blocker ends. Decorative:
 * each row and the forecast panel say the same in words.
 */

export interface DependencyLine {
  id: string;
  /** The blocker's end and the waiting item's start, in the timeline's pixels. */
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** The waiting item starts before its blocker ends. */
  conflict: boolean;
}

export interface DependencyLinesProps {
  lines: readonly DependencyLine[];
  width: number;
  height: number;
  className?: string;
}

const GAP = 8;

/** An elbow: out of the blocker, down to the row, into the waiting bar. */
export function dependencyPath(line: DependencyLine): string {
  const { from, to } = line;
  const out = from.x + GAP;
  if (to.x - GAP >= out) {
    const mid = Math.round((out + to.x - GAP) / 2);
    return `M ${from.x} ${from.y} H ${mid} V ${to.y} H ${to.x}`;
  }
  // The waiting bar starts before the blocker ends: go round, under the blocker's row.
  const turn = from.y + (to.y > from.y ? 1 : -1) * 14;
  return `M ${from.x} ${from.y} H ${out} V ${turn} H ${to.x - GAP} V ${to.y} H ${to.x}`;
}

export function DependencyLines({ lines, width, height, className }: DependencyLinesProps) {
  const id = `deps-${useId().replace(/[^\w-]/g, '')}`;
  if (lines.length === 0) return null;
  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      className={cx('pointer-events-none absolute top-0 left-0 overflow-visible', className)}
    >
      <defs>
        {(['quiet', 'warn'] as const).map((tone) => (
          <marker
            key={tone}
            id={`${id}-${tone}`}
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 6 3 L 0 6 z" fill={tone === 'warn' ? 'var(--amber)' : 'var(--tx-3)'} />
          </marker>
        ))}
      </defs>
      {lines.map((line) => (
        <path
          key={line.id}
          d={dependencyPath(line)}
          fill="none"
          stroke={line.conflict ? 'var(--amber)' : 'var(--tx-3)'}
          strokeWidth={1.25}
          strokeDasharray={line.conflict ? '3 3' : undefined}
          markerEnd={`url(#${id}-${line.conflict ? 'warn' : 'quiet'})`}
        />
      ))}
    </svg>
  );
}
