import { Button } from '@bemmoly/ui';
import { useState, type DragEvent } from 'react';
import { NO_BOARD_PERMISSION } from '../../hooks/settings-access.ts';
import { cx } from '../cx.ts';
import { useDragList } from '../drag.ts';
import {
  addColumn,
  MIN_COLUMNS,
  moveColumn,
  moveStatus,
  removeColumn,
  renameColumn,
  setWip,
  unmappedStatuses,
} from '../model/columns.ts';
import { EditFooter, SectionHeading, ToggleCard } from '../section.tsx';
import { ColumnCard } from './column-card.tsx';
import { StatusChip } from './status-chip.tsx';
import { footerProps, type BoardTabProps } from './tab-props.ts';

/** The Columns tab: columns mapped to statuses, WIP limits, unmapped statuses and the toggles. */
export function ColumnsTab(props: BoardTabProps) {
  const { settings, mode, access } = props;
  const config = settings.value?.config;
  const editing = mode === 'edit';
  const editable = editing && access.configureBoard;
  const [draggedStatus, setDraggedStatus] = useState<string | null>(null);
  const [overUnmapped, setOverUnmapped] = useState(false);
  const columnDrag = useDragList({
    axis: 'x',
    disabled: !editable,
    onMove: (from, to) => settings.updateConfig((current) => moveColumn(current, from, to)),
  });
  if (!config) return null;

  const statusDragStart = (statusId: string) => (event: DragEvent) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';
    setDraggedStatus(statusId);
  };
  const dropStatus = (columnId: string | null) => {
    const statusId = draggedStatus;
    setDraggedStatus(null);
    setOverUnmapped(false);
    if (statusId) settings.updateConfig((current) => moveStatus(current, statusId, columnId));
  };
  const stepStatus = (statusId: string, step: -1 | 0 | 1) =>
    settings.updateConfig((current) => {
      if (step === 0) return moveStatus(current, statusId, null);
      const from = current.columns.findIndex((column) => column.statusIds.includes(statusId));
      const target = current.columns[from + step];
      return target ? moveStatus(current, statusId, target.id) : current;
    });
  const unmapped = unmappedStatuses(config, settings.statuses);
  const toggle =
    (key: 'collapseEmptyColumns' | 'showColumnCounts' | 'showUnassigned') => (checked: boolean) =>
      settings.updateConfig((current) => ({ ...current, [key]: checked }));
  const workflowHref = settings.project ? `/work/workflow/${settings.project.key}` : '/work';

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Columns"
        description="Drag to reorder. Each column maps one or more workflow statuses; every status must live in exactly one column. Unmapped statuses stay off the board."
        mode={mode}
        locked={access.editWip ? undefined : NO_BOARD_PERMISSION}
        onEdit={props.onEdit}
        actions={
          editable ? (
            <Button
              className="whitespace-nowrap"
              onClick={() => settings.updateConfig((current) => addColumn(current))}
            >
              + Add column
            </Button>
          ) : null
        }
      />
      <div className="overflow-x-auto pb-1.5">
        <div
          className="grid gap-2.5"
          style={{ gridTemplateColumns: `repeat(${config.columns.length}, minmax(190px, 1fr))` }}
        >
          {config.columns.map((column, index) => (
            <div
              key={column.id}
              {...columnDrag.item(index)}
              className={cx(columnDrag.over === index && 'rounded-card shadow-ring-ac')}
            >
              <ColumnCard
                column={column}
                statuses={settings.statuses}
                counts={settings.counts}
                showCounts={settings.hasCounts}
                editable={editable}
                wipEditable={editing && access.editWip}
                canRemove={config.columns.length > MIN_COLUMNS}
                gripProps={columnDrag.handle(index, config.columns.length)}
                statusDragging={draggedStatus !== null}
                onRename={(name) =>
                  settings.updateConfig((current) => renameColumn(current, column.id, name))
                }
                onWip={(text) =>
                  settings.updateConfig((current) => setWip(current, column.id, text))
                }
                onRemove={() =>
                  settings.updateConfig((current) => removeColumn(current, column.id))
                }
                onStatusDragStart={statusDragStart}
                onStatusDragEnd={() => setDraggedStatus(null)}
                onStatusDrop={() => dropStatus(column.id)}
                onStatusStep={stepStatus}
              />
            </div>
          ))}
        </div>
      </div>
      <div
        className={cx(
          'flex flex-wrap items-center gap-2.5 rounded-panel border bg-sf px-3.5 py-2.5',
          overUnmapped ? 'border-ac shadow-ring' : 'border-br',
        )}
        {...(editable && draggedStatus
          ? {
              onDragOver: (event: DragEvent) => {
                event.preventDefault();
                setOverUnmapped(true);
              },
              onDragLeave: () => setOverUnmapped(false),
              onDrop: (event: DragEvent) => {
                event.preventDefault();
                dropStatus(null);
              },
            }
          : {})}
      >
        <span className="font-semibold">Unmapped statuses</span>
        {unmapped.length === 0 && <span className="text-12h text-tx5">None</span>}
        {unmapped.map((status) => (
          <StatusChip
            key={status.id}
            status={status}
            variant="unmapped"
            movable={editable}
            onDragStart={statusDragStart(status.id)}
            onDragEnd={() => setDraggedStatus(null)}
            onStep={(step) =>
              step === 1 && config.columns[0]
                ? settings.updateConfig((current) =>
                    moveStatus(current, status.id, current.columns[0]?.id ?? null),
                  )
                : undefined
            }
          />
        ))}
        <span className="ml-auto text-12 text-tx4">
          Edit statuses in{' '}
          <a href={workflowHref} className="text-ac hover:text-ac-d">
            Workflow
          </a>
        </span>
      </div>
      <ToggleCard
        readOnly={!editable}
        toggles={[
          {
            title: 'Let members collapse columns',
            description: 'Personal, not shared.',
            checked: config.collapseEmptyColumns,
            onChange: toggle('collapseEmptyColumns'),
          },
          {
            title: 'Show issue count in column header',
            checked: config.showColumnCounts,
            onChange: toggle('showColumnCounts'),
          },
          {
            title: 'Highlight unassigned issues',
            description: 'Dashed border on cards with no assignee.',
            checked: config.showUnassigned,
            onChange: toggle('showUnassigned'),
          },
        ]}
      />
      {editing && (
        <EditFooter
          {...footerProps(props, settings.dirty.columns)}
          {...(access.configureBoard
            ? {}
            : { note: 'You can change WIP limits; the rest needs "Configure board".' })}
        />
      )}
    </div>
  );
}
