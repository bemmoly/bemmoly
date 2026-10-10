import {
  epicFill,
  KanbanColumnHeader,
  KanbanColumnHeaders,
  Swimlane,
  SwimlaneHeader,
  type StatusStage,
} from '@bemmoly/ui';
import { memo, type ReactNode } from 'react';
import { useBoardLanes } from '../hooks/board-filters.ts';
import type { BoardModel, ColumnModel, LaneModel } from '../hooks/board-model.ts';
import { cellId } from '../hooks/board-window.ts';
import { BoardCell } from './board-cell.tsx';
import { useColumnCreate } from './column-create.tsx';

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
  const toggle = useBoardLanes((state) => state.toggle);
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
          {...(lane.color ? { colorClassName: epicFill(lane.color) } : {})}
          open={open}
          onToggle={() => toggle(lane.id)}
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
          laneColor={lane.color}
        />
      ))}
    </Swimlane>
  );
});

export interface BoardGridProps {
  model: BoardModel;
  kanban: boolean;
  /** Drawn under the column headings in place of the lanes, when the board has no cards. */
  empty?: ReactNode;
  /** Each column's status glyph, from its first status. */
  stages: Readonly<Record<string, StatusStage>>;
  /** Whether a column offers "New issue". */
  canCreate: boolean;
}

/**
 * The board body from the mock: the sticky column headings over the lanes, 10px apart, at
 * least 1260px wide so five columns never squeeze; the page scrolls sideways instead.
 */
export function BoardGrid({ model, kanban, empty, stages, canCreate }: BoardGridProps) {
  const collapsed = useBoardLanes((state) => state.collapsed);
  const openCreate = useColumnCreate((state) => state.open);
  const firstOpen = model.lanes.find((lane) => !collapsed.includes(lane.id)) ?? model.lanes[0];
  return (
    <div className="flex min-w-240 flex-col max-md:min-w-0">
      <KanbanColumnHeaders columns={model.columns.length}>
        {model.columns.map((column) => (
          <KanbanColumnHeader
            key={column.id}
            name={column.name}
            stage={stages[column.id] ?? 'todo'}
            count={column.count}
            {...(column.wipLimit === null ? {} : { wipLimit: column.wipLimit })}
            {...(canCreate && firstOpen
              ? { onAdd: () => openCreate(cellId(firstOpen.id, column.id)) }
              : {})}
          />
        ))}
      </KanbanColumnHeaders>
      {empty ? (
        <div className="mt-2 rounded-card border border-dashed border-line bg-card">{empty}</div>
      ) : (
        <div className="flex flex-col">
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
      )}
    </div>
  );
}
