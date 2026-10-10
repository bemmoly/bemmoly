import { cx } from '../cx.ts';
import type { DragEvent, KeyboardEvent } from 'react';
import type { StatusInfo } from '../model/columns.ts';

/** A status without its own colour takes its category's: grey to do, accent in progress, green done. */
const CATEGORY_DOT: Record<StatusInfo['category'], string> = {
  todo: 'bg-tx5',
  in_progress: 'bg-ac',
  done: 'bg-ok',
};

/**
 * The 8px dot of a workflow status; a colour set on the status is data, so it comes inline.
 * Off the board (`muted`) every status is grey, as the mock's unmapped statuses are.
 */
export function StatusDot({ status, muted = false }: { status: StatusInfo; muted?: boolean }) {
  const own = !muted && status.color;
  return (
    <span
      aria-hidden
      className={cx(
        'size-2 shrink-0 rounded-full',
        muted ? 'bg-tx5' : own ? null : CATEGORY_DOT[status.category],
      )}
      style={own ? { backgroundColor: status.color ?? undefined } : undefined}
    />
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

/** A status in a column, as the mock draws it: dot, name and the mono issue count. */
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
        'flex items-center border border-br bg-sf text-12h',
        variant === 'column'
          ? 'gap-2 rounded-control px-2.25 py-1.75'
          : 'gap-1.5 rounded-control px-2.25 py-1',
        movable && 'cursor-grab focus-ring',
      )}
    >
      <StatusDot status={status} muted={variant === 'unmapped'} />
      <span className={variant === 'column' ? 'flex-1' : undefined}>{status.name}</span>
      {variant === 'column' && count !== undefined && (
        <span className="font-mono text-11 text-tx5">{count}</span>
      )}
    </div>
  );
}
