import { KanbanColumnHeader, KanbanColumnHeaders, Swimlane, SwimlaneHeader } from '@bemmoly/ui';
import { memo } from 'react';
import { useBoardFilterStore } from '../hooks/board-filters.ts';
import type { BoardModel, ColumnModel, LaneModel } from '../hooks/board-model.ts';
import { BoardCell } from './board-cell.tsx';
import { laneFill } from './card-view.ts';

/** "Oct 7" from an ISO date, in UTC so the day never shifts with the viewer's zone. */
function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function laneMeta(lane: LaneModel, kanban: boolean): string {
  const issues = `${lane.count} ${lane.count === 1 ? 'issue' : 'issues'}`;
  return kanban ? `${issues} · ${lane.inFlight} in flight` : `${issues} · ${lane.points} pts`;
}

function laneProgress(lane: LaneModel, columns: readonly ColumnModel[]): number {
  if (lane.points > 0) return (lane.donePoints / lane.points) * 100;
  const done = columns
    .filter((column) => column.done)
    .reduce((sum, column) => sum + (lane.cells[column.id]?.length ?? 0), 0);
  return lane.count > 0 ? (done / lane.count) * 100 : 0;
}

const Lane = memo(function Lane({
  lane,
  columns,
  kanban,
  open,
}: {
  lane: LaneModel;
  columns: readonly ColumnModel[];
  kanban: boolean;
  open: boolean;
}) {
  const toggle = useBoardFilterStore((state) => state.toggle);
  const bodyId = `lane-${lane.id}`;
  return (
    <Swimlane
      id={bodyId}
      columns={columns.length}
      open={open}
      header={
        <SwimlaneHeader
          name={lane.label}
          {...(lane.issueKey ? { laneKey: lane.issueKey } : {})}
          meta={laneMeta(lane, kanban)}
          progress={laneProgress(lane, columns)}
          {...(lane.dueAt ? { due: `Due ${shortDate(lane.dueAt)}` } : {})}
          colorClassName={laneFill(lane.hue)}
          open={open}
          onToggle={() => toggle('collapsed', lane.id)}
          controls={bodyId}
        />
      }
    >
      {columns.map((column) => (
        <BoardCell
          key={column.id}
          laneId={lane.id}
          laneLabel={lane.label}
          columnId={column.id}
          columnName={column.name}
          cards={lane.cells[column.id] ?? []}
          laneHue={lane.hue}
        />
      ))}
    </Swimlane>
  );
});

export interface BoardGridProps {
  model: BoardModel;
  kanban: boolean;
}

/**
 * The board body from the mock: the sticky column headings over the lanes, 10px apart, at
 * least 1260px wide so five columns never squeeze; the page scrolls sideways instead.
 */
export function BoardGrid({ model, kanban }: BoardGridProps) {
  const collapsed = useBoardFilterStore((state) => state.collapsed);
  return (
    <div className="flex min-w-315 flex-col">
      <KanbanColumnHeaders columns={model.columns.length}>
        {model.columns.map((column) => (
          <KanbanColumnHeader
            key={column.id}
            name={column.name}
            count={column.count}
            {...(column.wipLimit === null ? {} : { wipLimit: column.wipLimit })}
          />
        ))}
      </KanbanColumnHeaders>
      <div className="flex flex-col gap-2.5">
        {model.lanes.map((lane) => (
          <Lane
            key={lane.id}
            lane={lane}
            columns={model.columns}
            kanban={kanban}
            open={!collapsed.includes(lane.id)}
          />
        ))}
      </div>
    </div>
  );
}
