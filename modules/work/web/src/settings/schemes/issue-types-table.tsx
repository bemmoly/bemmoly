import type { IssueType, IssueTypeLevel } from '@bemmoly/module-work/shared';
import { Table, TableSkeleton, TypeGlyph, rowReveal, type TableColumn } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useDragList } from '../drag.ts';
import { InlineName } from '../inline-name.tsx';

export const LEVELS: Record<IssueTypeLevel, string> = {
  epic: 'Epic level',
  standard: 'Standard',
  subtask: 'Subtask level',
};

/**
 * The project's issue types as one table: a grip to reorder (drag, or ↑↓ on the grip), the
 * type glyph and a name renamed in place, its level, and where it comes from. Inherited
 * types read only; overriding the scheme makes them the project's to change.
 */
export function IssueTypesTable({
  rows,
  loading,
  editable,
  onRename,
  onMove,
}: {
  rows: readonly IssueType[];
  loading: boolean;
  editable: boolean;
  onRename: (type: IssueType, name: string) => void;
  onMove: (from: number, to: number) => void;
}) {
  const drag = useDragList({ onMove, disabled: !editable });
  const columns: TableColumn<IssueType>[] = [
    ...(editable
      ? [
          {
            key: 'grip',
            header: <span className="sr-only">Reorder</span>,
            width: '20px',
            render: (type: IssueType) => (
              <span
                {...drag.handle(rows.indexOf(type), rows.length)}
                role="button"
                tabIndex={0}
                aria-label={`Move ${type.name}; use the arrow keys`}
                title="Drag to reorder, or use the arrow keys"
                className={`flex cursor-grab text-tx-3 ${rowReveal} focus-visible:outline-2 focus-visible:outline-ac`}
              >
                <Icon name="drag" size={14} />
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'type',
      header: 'Type',
      width: 'minmax(0,1fr)',
      render: (type) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <TypeGlyph type={type} size={18} />
          <span className="flex min-w-0 flex-col items-start gap-px">
            <InlineName
              value={type.name}
              label={`Rename ${type.name}`}
              editable={editable}
              onRename={(name) => onRename(type, name)}
              className="font-semibold"
            />
            <span className="truncate text-12 text-tx-3" title={type.description ?? undefined}>
              {type.description ?? LEVELS[type.level]}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: 'level',
      header: 'Level',
      width: '120px',
      hideOnPhone: true,
      render: (type) => <span className="text-tx-2">{LEVELS[type.level]}</span>,
    },
    {
      key: 'source',
      header: 'Source',
      width: '96px',
      render: (type) =>
        type.projectId && !type.originId ? (
          <span className="text-12 font-semibold text-ac">This project</span>
        ) : (
          <span className="text-12 text-tx-3">Default</span>
        ),
    },
  ];
  if (loading)
    return (
      <TableSkeleton
        label="Loading issue types"
        rows={5}
        columns={columns.map((column) => ({ width: column.width }))}
      />
    );
  return (
    <Table
      label="Issue types"
      columns={columns}
      rows={rows}
      rowKey={(type) => type.id}
      rowProps={(_, index) => ({
        ...drag.item(index),
        'data-over': drag.over === index && drag.dragging !== index,
      })}
    />
  );
}
