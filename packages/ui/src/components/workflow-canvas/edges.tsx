import type { HTMLAttributes, ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { StatusGlyph } from '../glyphs/status-glyph.tsx';

export interface TransitionEdgeProps {
  /** The SVG path in canvas units (the mock's 1000 x 560 box). */
  d: string;
  /** From the selected status: the accent at 2px instead of tx5 at 1.5px. */
  highlighted?: boolean;
  /** A global transition from any status: dashed 4 4. */
  any?: boolean;
  /** A problem from validation names this transition: danger at 2px. */
  invalid?: boolean;
}

const EDGE_TONES = {
  rest: { stroke: 'stroke-tx5', marker: 'url(#workflow-arrow)' },
  highlighted: { stroke: 'stroke-ac', marker: 'url(#workflow-arrow-ac)' },
  invalid: { stroke: 'stroke-danger', marker: 'url(#workflow-arrow-danger)' },
} as const;

/** One transition arrow; the canvas defines the arrowhead markers it points with. */
export function TransitionEdge({
  d,
  highlighted = false,
  any = false,
  invalid = false,
}: TransitionEdgeProps) {
  const tone = EDGE_TONES[invalid ? 'invalid' : highlighted ? 'highlighted' : 'rest'];
  return (
    <path
      d={d}
      fill="none"
      className={tone.stroke}
      strokeWidth={highlighted || invalid ? 2 : 1.5}
      strokeDasharray={any ? '4 4' : undefined}
      markerEnd={tone.marker}
    />
  );
}

export interface TransitionLabelProps extends HTMLAttributes<HTMLElement> {
  /** Centre of the label in canvas percentages. */
  x: string;
  y: string;
  highlighted?: boolean;
  /** The transition open in the side panel: the accent border on ac-bg. */
  selected?: boolean;
  /** A problem from validation names this transition. */
  invalid?: boolean;
  /** A button that selects the transition, reached by Tab like the nodes. */
  interactive?: boolean;
}

const LABEL_TONES = {
  rest: 'border-br bg-sf text-tx4',
  highlighted: 'border-ac-br bg-sf text-ac',
  selected: 'border-ac bg-ac-bg text-ac',
  invalid: 'border-danger bg-sf text-danger',
} as const;

/** The transition name on its edge: 11px, 2px 7px, 4px radius, white with a br border. */
export function TransitionLabel({
  x,
  y,
  highlighted = false,
  selected = false,
  invalid = false,
  interactive = false,
  className,
  style,
  ...rest
}: TransitionLabelProps) {
  const tone = invalid ? 'invalid' : selected ? 'selected' : highlighted ? 'highlighted' : 'rest';
  const classes = cx(
    'absolute flex -translate-1/2 items-center gap-1 rounded-xs border px-1.75 py-0.5 font-sans text-11 whitespace-nowrap',
    LABEL_TONES[tone],
    interactive && cx('cursor-pointer', focusRing),
    className,
  );
  const position = { left: x, top: y, ...style };
  if (!interactive) return <span style={position} className={classes} {...rest} />;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-invalid={invalid || undefined}
      style={position}
      className={classes}
      {...rest}
    />
  );
}

/** The legend in the canvas corner: line styles and the three category dots, 11.5px tx4. */
export function WorkflowLegend({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        'absolute bottom-3.5 left-4 flex items-center gap-3.5 text-11h text-tx4',
        className,
      )}
    >
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="w-5 border-t-[1.5px] border-tx5" />
        <span className="lowercase">Transition</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="w-5 border-t-[1.5px] border-dashed border-tx5" />
        any status
      </span>
      <span className="flex items-center gap-1.5">
        <StatusGlyph stage="todo" size={12} decorative />
        To do
      </span>
      <span className="flex items-center gap-1.5">
        <StatusGlyph stage="progress" size={12} decorative />
        In progress
      </span>
      <span className="flex items-center gap-1.5">
        <StatusGlyph stage="done" size={12} decorative />
        Done
      </span>
    </div>
  );
}

export interface TransitionRowProps {
  children: ReactNode;
  onMore?: () => void;
  /** Names the ··· button for this row, e.g. "Edit Approve"; rows in a list need distinct names. */
  moreLabel?: string;
  className?: string;
}

/** "→ Testing (Approve)": a transition out of the selected status, in the side panel. */
export function TransitionRow({
  children,
  onMore,
  moreLabel = 'Transition actions',
  className,
}: TransitionRowProps) {
  return (
    <div
      className={cx(
        'flex items-center gap-2 rounded-control border border-br px-2.5 py-2 text-12h text-tx',
        className,
      )}
    >
      <Icon name="arrow" size={14} className="text-tx5" />
      <span className="flex-1 font-medium">{children}</span>
      {onMore && (
        <button
          type="button"
          aria-label={moreLabel}
          onClick={onMore}
          className={cx(
            'flex cursor-pointer border-0 bg-transparent p-0 text-tx6 hover:text-tx2',
            focusRing,
          )}
        >
          <Icon name="more" size={14} />
        </button>
      )}
    </div>
  );
}
