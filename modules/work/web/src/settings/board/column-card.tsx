import { Icon } from '@bemmoly/ui/icons';
import { useState, type DragEvent, type HTMLAttributes } from 'react';
import { cx } from '../cx.ts';
import type { Column, StatusInfo } from '../model/columns.ts';
import { StatusChip, StatusDot } from './status-chip.tsx';

export interface ColumnCardProps {
  column: Column;
  statuses: readonly StatusInfo[];
  counts: Record<string, number>;
  showCounts: boolean;
  /** Name, statuses and removal: "Configure board". */
  editable: boolean;
  /** The WIP limit alone: "Edit WIP limits" is enough. */
  wipEditable: boolean;
  canRemove: boolean;
  /** Props for the grip, from useDragList: drag and arrow keys reorder the column. */
  gripProps: HTMLAttributes<HTMLSpanElement>;
  /** A status chip is being dragged; the card accepts it. */
  statusDragging: boolean;
  onRename: (name: string) => void;
  onWip: (text: string) => void;
  onRemove: () => void;
  onStatusDragStart: (statusId: string) => (event: DragEvent) => void;
  onStatusDragEnd: () => void;
  onStatusDrop: () => void;
  onStatusStep: (statusId: string, step: -1 | 0 | 1) => void;
}

/**
 * One column of the column editor, as the review draws it: the first status's glyph, the
 * name and a compact WIP field ("No limit" until set) on one line, then its statuses on the
 * sunken surface and the dashed "Drop a status" target. Narrow enough that five fit.
 */
export function ColumnCard(props: ColumnCardProps) {
  const { column, statuses, counts, editable, wipEditable } = props;
  const [wip, setWip] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const mapped = column.statusIds
    .map((id) => statuses.find((status) => status.id === id))
    .filter((status): status is StatusInfo => Boolean(status));
  const accept = editable && props.statusDragging;
  return (
    <div
      className={cx(
        'flex min-h-52 flex-col rounded-[10px] border bg-card',
        accept && hovered ? 'border-ac shadow-ring' : 'border-line',
      )}
      {...(accept
        ? {
            onDragOver: (event: DragEvent) => {
              event.preventDefault();
              setHovered(true);
            },
            onDragLeave: () => setHovered(false),
            onDrop: (event: DragEvent) => {
              event.preventDefault();
              event.stopPropagation();
              setHovered(false);
              props.onStatusDrop();
            },
          }
        : {})}
    >
      <div className="flex flex-col gap-1.5 px-2.5 pt-2.5 pb-2">
        <div className="flex items-center gap-1.5">
          {editable ? (
            <span
              {...props.gripProps}
              tabIndex={0}
              role="button"
              aria-label={`Move ${column.name}`}
              title="Drag to reorder, or use the arrow keys"
              className="-ml-1 flex cursor-grab text-tx-3 focus-ring"
            >
              <Icon name="drag" size={14} />
            </span>
          ) : (
            mapped[0] && <StatusDot status={mapped[0]} size={14} />
          )}
          <input
            aria-label="Column name"
            value={column.name}
            readOnly={!editable}
            onChange={(event) => props.onRename(event.target.value)}
            className={cx(
              'min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-1 py-0.5 font-sans text-13 font-semibold text-tx outline-0',
              editable && 'hover:border-line focus:border-ac',
            )}
          />
          {editable && props.canRemove && (
            <button
              type="button"
              aria-label={`Remove ${column.name}`}
              title={`Remove ${column.name}`}
              onClick={props.onRemove}
              className="flex cursor-pointer rounded-sm border-0 bg-transparent p-0.5 text-tx-3 hover:text-tx focus-ring"
            >
              <Icon name="close" size={13} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-12 text-tx-3">
          <label className="flex items-center gap-1" title="Work in progress limit">
            <span className="whitespace-nowrap">WIP</span>
            <input
              aria-label={`${column.name} WIP limit`}
              inputMode="numeric"
              placeholder="No limit"
              readOnly={!wipEditable}
              value={wip ?? (column.wipLimit ? String(column.wipLimit) : '')}
              onChange={(event) => {
                setWip(event.target.value);
                props.onWip(event.target.value);
              }}
              onBlur={() => setWip(null)}
              className={cx(
                'w-14 min-w-0 rounded-sm border border-line bg-transparent px-1.5 py-px text-12 text-tx tabular-nums outline-0 placeholder:text-tx-3 focus:border-ac',
                !wipEditable && 'border-transparent px-0',
              )}
            />
          </label>
          {column.done && (
            <span
              className="ml-auto flex shrink-0 text-ok-fg"
              title="Resolves: issues here count as done"
            >
              <Icon name="check" size={13} />
              <span className="sr-only">Resolves</span>
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-2 pb-2">
        {mapped.map((status) => (
          <StatusChip
            key={status.id}
            status={status}
            count={props.showCounts ? (counts[status.id] ?? 0) : undefined}
            variant="column"
            movable={editable}
            onDragStart={props.onStatusDragStart(status.id)}
            onDragEnd={props.onStatusDragEnd}
            onStep={(step) => props.onStatusStep(status.id, step)}
          />
        ))}
        <div
          className={cx(
            'mt-auto rounded-md border border-dashed p-1.5 text-center text-12',
            accept && hovered ? 'border-ac bg-ac-bg text-ac' : 'border-line text-tx-3',
          )}
        >
          Drop a status
        </div>
      </div>
    </div>
  );
}
