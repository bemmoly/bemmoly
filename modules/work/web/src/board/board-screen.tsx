import type { BoardView } from '@bemmoly/module-work/shared';
import { Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useId, useMemo } from 'react';
import { useBoardActions } from '../hooks/board-actions.ts';
import { useBoardVerdicts } from '../hooks/board-dnd.ts';
import { useBoardDragStore } from '../hooks/board-drag-store.ts';
import { boardIssueOrder, type BoardModel } from '../hooks/board-model.ts';
import { useBoardScreen } from '../hooks/board-screen.ts';
import { useIssueQuickActions } from '../hooks/issue-quick-actions.ts';
import { DOCKED_SLIDE_OVER_QUERY, useMediaQuery } from '../hooks/media-query.ts';
import { useIssuePeek } from '../shared/issue-peek.ts';
import { useIssueFilters } from '../shared/issue-filters.ts';
import { openCreate, useRecordRecent, useScreenActions } from '@bemmoly/core-web';
import { navigateTo, workPaths } from '../hooks/issue-navigation.ts';
import { useSavedFilters } from '../hooks/saved-filters.ts';
import { IssueSlideOver, useRememberIssueList } from '../issue/index.ts';
import type { WorkScreenProps } from '../routes.tsx';
import { BoardSkeleton } from '../skeletons/board-skeleton.tsx';
import { BoardContext, type BoardShared } from './board-context.ts';
import { BoardGrid } from './board-grid.tsx';
import { BoardHeader } from './board-header.tsx';
import { BoardToolbar } from './board-toolbar.tsx';

type Screen = ReturnType<typeof useBoardScreen>;

/** Reads the keyboard drag aloud; the only part of the screen that renders on each step. */
function BoardAnnouncer() {
  const announcement = useBoardDragStore((state) => state.announcement);
  return (
    <div aria-live="assertive" className="sr-only">
      {announcement}
    </div>
  );
}

/** Fetches the carried card's transitions and marks the columns it may enter. */
function BoardVerdicts({ model }: { model: BoardModel }) {
  useBoardVerdicts(model);
  return null;
}

/** The board once its view is in: everything that needs the laid-out model. */
function BoardBody({
  screen,
  view,
  model,
}: {
  screen: Screen;
  view: BoardView;
  model: BoardModel;
}) {
  const savedFilters = useSavedFilters(screen.project);
  const quick = useIssueQuickActions();
  const { clear } = useIssueFilters();
  const docked = useMediaQuery(DOCKED_SLIDE_OVER_QUERY);
  // Screen order: lane by lane, column by column, top to bottom, as j and k step.
  const order = useMemo(() => boardIssueOrder(model), [model]);
  const peek = useIssuePeek(() => order);
  useRememberIssueList({
    label: screen.sprint ? `${screen.sprint.name} board` : 'Board',
    keys: order,
  });

  const actions = useBoardActions(model, view.board.id, peek.open);
  const instructionsId = useId();
  const project = screen.project;
  const sprintId = screen.sprint?.id;
  const firstStatus = (columnId: string) =>
    view.board.config.columns.find((column) => column.id === columnId)?.statusIds[0];
  const laneKind = view.board.config.lanes.kind;
  const createIn = useMemo(() => {
    const typeId = screen.defaultTypeId;
    if (!project || !typeId) return undefined;
    return (laneId: string, columnId: string, title: string) =>
      quick.create(
        {
          projectId: project.id,
          typeId,
          title,
          priority: 'medium',
          ...(sprintId ? { sprintId } : {}),
          ...(laneKind === 'epic' && laneId !== 'none' && laneId !== 'all'
            ? { parentId: laneId }
            : {}),
          ...(laneKind === 'assignee' && laneId !== 'none' && laneId !== 'all'
            ? { assigneeId: laneId }
            : {}),
        },
        firstStatus(columnId),
      );
  }, [project, screen.defaultTypeId, sprintId, laneKind, quick, view.board.config]);
  const shared = useMemo<BoardShared>(
    () => ({
      actions,
      vocab: screen.vocab,
      quick,
      selectedKey: peek.issueKey,
      instructionsId,
      ...(createIn ? { createIn } : {}),
    }),
    [actions, screen.vocab, quick, peek.issueKey, instructionsId, createIn],
  );
  const inFlight = model.lanes.reduce((sum, lane) => sum + lane.inFlight, 0);
  const cards = view.cards.length;
  if (!project) return null;
  const empty =
    screen.shownTotal > 0 ? undefined : cards > 0 ? (
      <EmptyState
        icon={<Icon name="filter" />}
        title="No issues match these filters"
        description="Clear a filter or two to see more of the board."
        action={<Button onClick={clear}>Clear filters</Button>}
      />
    ) : screen.kanban ? (
      <EmptyState
        icon={<Icon name="board" />}
        title="No issues on the board yet"
        description="Create an issue and it lands in the first column."
        action={
          <Button variant="primary" onClick={() => openCreate('work.create-issue')}>
            Create issue
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={<Icon name="sprint" />}
        title={screen.sprint ? 'Nothing in this sprint yet' : 'No sprint is running'}
        description={
          screen.sprint
            ? 'Plan the sprint from the backlog and its issues show up here.'
            : 'Start a sprint from the backlog and its issues show up here.'
        }
        action={
          <Button variant="primary" onClick={() => navigateTo(`/work/backlog/${project.key}`)}>
            Open the backlog
          </Button>
        }
      />
    );
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-col bg-canvas">
          <BoardHeader
            project={project}
            view={view}
            metrics={screen.metrics}
            sprint={screen.sprint}
            inFlight={inFlight}
            doingPoints={model.lanes.reduce(
              (sum, lane) =>
                sum +
                model.columns
                  .slice(1)
                  .filter((column) => !column.done)
                  .reduce(
                    (cells, column) =>
                      cells +
                      (lane.cells[column.id] ?? []).reduce(
                        (p, card) => p + (card.estimate ?? 0),
                        0,
                      ),
                    0,
                  ),
              0,
            )}
          />
          <BoardToolbar
            options={screen.filterOptions}
            laneLabel={screen.laneLabel}
            grouping={screen.grouping}
            onGrouping={screen.setGrouping}
            lqlSources={screen.lqlSources}
            lqlError={screen.filterError ? screen.filterError.message : null}
            savedFilters={savedFilters}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-sunken px-6 pb-6 max-md:px-4">
          <BoardContext.Provider value={shared}>
            <BoardGrid
              model={model}
              kanban={screen.kanban}
              empty={empty}
              stages={screen.stages}
              canCreate={createIn !== undefined}
            />
          </BoardContext.Provider>
        </div>
        <p id={instructionsId} hidden>
          Press Enter to open the issue. Press space to pick the card up, the arrow keys to move it,
          space again to drop it and Escape to put it back.
        </p>
        <BoardAnnouncer />
        <BoardVerdicts model={model} />
      </div>
      <IssueSlideOver
        issueKey={peek.issueKey}
        onClose={peek.close}
        variant={docked ? 'docked' : 'overlay'}
        {...(peek.previous ? { onPrevious: peek.previous } : {})}
        {...(peek.next ? { onNext: peek.next } : {})}
      />
    </div>
  );
}

/** The board as a recent item and its palette actions, once its project is known. */
function useBoardPresence(project: { key: string; name: string } | undefined) {
  useRecordRecent(
    project
      ? {
          id: `work.board:${project.key}`,
          title: 'Board',
          context: project.name,
          path: workPaths.board(project.key),
          look: { kind: 'icon', icon: 'board', moduleId: 'work' },
          group: 'Boards',
        }
      : null,
  );
  useScreenActions(
    project
      ? [
          {
            id: 'work.go-backlog',
            title: 'Go to backlog',
            keys: 'G L',
            look: { kind: 'icon', icon: 'backlog' },
            run: () => navigateTo(workPaths.backlog(project.key)),
          },
        ]
      : null,
  );
}

/** The Board: Scrum or Kanban, matching the Board mock, with live updates over the socket. */
export default function BoardScreen({ projectKey }: WorkScreenProps) {
  const screen = useBoardScreen(projectKey);
  useBoardPresence(screen.project);
  if (screen.isPending) return <BoardSkeleton />;
  if (screen.error) {
    return (
      <EmptyState
        icon={<Icon name="alert" />}
        title="The board did not load"
        description={screen.error.message}
        action={<Button onClick={screen.refetch}>Try again</Button>}
      />
    );
  }
  if (!screen.project) {
    // A link to a project the person cannot see must not read as if no project existed.
    return (
      <EmptyState
        icon={<Icon name="project" />}
        title="No project"
        description={
          projectKey
            ? `There is no project ${projectKey.toUpperCase()} you can see.`
            : 'Create a project to get a board.'
        }
        action={
          <Button variant="primary" onClick={() => navigateTo(workPaths.projects())}>
            {projectKey ? 'See your projects' : 'Create a project'}
          </Button>
        }
      />
    );
  }
  if (!screen.view || !screen.model) {
    return (
      <EmptyState
        icon={<Icon name="board" />}
        title={`${screen.project.name} has no board`}
        description="An admin can add one in Board settings."
        action={
          <Button onClick={() => navigateTo(`/work/settings/${screen.project?.key ?? ''}/board`)}>
            Open board settings
          </Button>
        }
      />
    );
  }
  return <BoardBody screen={screen} view={screen.view} model={screen.model} />;
}
