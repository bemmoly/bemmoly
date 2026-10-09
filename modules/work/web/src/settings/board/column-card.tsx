import { Badge } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState, type DragEvent, type HTMLAttributes } from 'react';
import { cx } from '../cx.ts';
import type { Column, StatusInfo } from '../model/columns.ts';
import { StatusChip } from './status-chip.tsx';

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
 * One column of the mock's column editor: a 260px card with the name, the
 * WIP limit and RESOLVES on the done column over the sf2 header, then its
 * statuses and the dashed drop target.
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
        'flex min-h-65 flex-col overflow-hidden rounded-card border bg-sf',
        accept && hovered ? 'border-ac shadow-ring' : 'border-br',
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
      <div className="flex flex-col gap-2 border-b border-br-row bg-sf2 px-2.5 pt-2.5 pb-2">
        <div className="flex items-center gap-1.5">
          <span
            {...props.gripProps}
            {...(editable
              ? { tabIndex: 0, role: 'button', 'aria-label': `Move ${column.name}` }
              : {})}
            className={cx('flex text-tx6', editable && 'cursor-grab')}
          >
            <Icon name="drag" size={14} />
          </span>
          <input
            aria-label="Column name"
            value={column.name}
            readOnly={!editable}
            onChange={(event) => props.onRename(event.target.value)}
            className={cx(
              'min-w-0 flex-1 rounded-xs border border-transparent bg-transparent px-1.5 py-0.75 font-sans text-12h font-semibold text-tx outline-0',
              editable && 'hover:border-br3 focus:border-ac',
            )}
          />
          {editable && props.canRemove && (
            <button
              type="button"
              aria-label={`Remove ${column.name}`}
              onClick={props.onRemove}
              className="flex cursor-pointer border-0 bg-transparent px-1 text-tx6 hover:text-tx2"
            >
              <Icon name="close" size={13} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-12 text-tx4">
          <span className="whitespace-nowrap">WIP limit</span>
          <input
            aria-label={`${column.name} WIP limit`}
            inputMode="numeric"
            placeholder="–"
            readOnly={!wipEditable}
            value={wip ?? (column.wipLimit ? String(column.wipLimit) : '')}
            onChange={(event) => {
              setWip(event.target.value);
              props.onWip(event.target.value);
            }}
            onBlur={() => setWip(null)}
            className="w-10 rounded-xs border border-br3 bg-sf px-1.5 py-0.75 text-center font-mono text-12 font-medium text-tx outline-0 focus:border-ac"
          />
          {column.done && (
            <Badge tone="ok" className="ml-auto">
              RESOLVES
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
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
            'mt-auto rounded-control border border-dashed p-2 text-center text-12',
            accept && hovered ? 'border-ac bg-ac-bg2 text-ac' : 'border-br3 text-tx5',
          )}
        >
          Drop status here
        </div>
      </div>
    </div>
  );
}
