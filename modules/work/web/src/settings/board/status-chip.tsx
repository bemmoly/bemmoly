import { StatusGlyph, statusStage } from '@bemmoly/ui';
import { cx } from '../cx.ts';
import type { DragEvent, KeyboardEvent } from 'react';
import type { StatusInfo } from '../model/columns.ts';

/**
 * A workflow status as the review draws it everywhere: the circle that fills as work moves
 * right, coloured by its category only, so a custom colour never breaks the reading.
 */
export function StatusDot({ status, size = 12 }: { status: StatusInfo; size?: number }) {
  return (
    <StatusGlyph stage={statusStage(status.category, status.name)} label={status.name} size={size} />
  );
}

export interface StatusChipProps {
  status: StatusInfo;
  /** Issues in the status; hidden when counts are not known. */
  count?: number | undefined;
  /** In a column card (7px 9px block) or the unmapped bar (4px 9px inline). */
  variant: 'column' | 'unmapped';
  /** Edit mode: the chip drags, and arrow keys move it to the next column. */
  movable: boolean;
  onDragStart?: (event: DragEvent) => void;
  onDragEnd?: () => void;
  /** -1 or 1 for the previous or next column; 0 takes it off the board. */
  onStep?: (step: -1 | 0 | 1) => void;
}

/** A status in a column on the sunken surface: glyph, name and the mono issue count. */
export function StatusChip({
  status,
  count,
  variant,
  movable,
  onDragStart,
  onDragEnd,
  onStep,
}: StatusChipProps) {
  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, Delete: 0, Backspace: 0 }[event.key];
    if (step === undefined || !onStep) return;
    event.preventDefault();
    onStep(step as -1 | 0 | 1);
  };
  return (
    <div
      {...(movable
        ? {
            draggable: true,
            tabIndex: 0,
            role: 'button',
            'aria-label': `${status.name}: arrow keys move it between columns, Delete takes it off the board`,
            onDragStart,
            onDragEnd,
            onKeyDown,
          }
        : {})}
      className={cx(
        'flex items-center text-13 whitespace-nowrap',
        variant === 'column'
          ? 'gap-1.75 rounded-md bg-sunken px-2 py-1.5'
          : 'gap-1.5 rounded-pill bg-chip px-2.25 py-0.5 text-12',
        movable && 'cursor-grab focus-ring',
      )}
    >
      <StatusDot status={status} />
      <span className={variant === 'column' ? 'min-w-0 flex-1 truncate' : undefined} title={status.name}>
        {status.name}
      </span>
      {variant === 'column' && count !== undefined && (
        <span className="font-mono text-12 text-tx-3 tabular-nums">{count}</span>
      )}
    </div>
  );
}
