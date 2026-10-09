import type { BoardView } from '@bemmoly/module-work/shared';
import { Button, EmptyState, Skeleton } from '@bemmoly/ui';
import { useId, useMemo } from 'react';
import { useBoardActions } from '../hooks/board-actions.ts';
import { useBoardVerdicts } from '../hooks/board-dnd.ts';
import { useBoardDragStore } from '../hooks/board-drag-store.ts';
import type { BoardModel } from '../hooks/board-model.ts';
import { useBoardScreen } from '../hooks/board-screen.ts';
import { useBoardIssueSlideOver } from '../hooks/board-slide-over.ts';
import { IssueSlideOver } from '../issue/index.ts';
import type { WorkScreenProps } from '../routes.tsx';
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
  const slideOver = useBoardIssueSlideOver();
  const actions = useBoardActions(model, view.board.id, slideOver.openIssue);
  const instructionsId = useId();
  const shared = useMemo<BoardShared>(
    () => ({
      actions,
      vocab: screen.vocab,
      isDimmed: screen.isDimmed,
      selectedKey: slideOver.issueKey,
      instructionsId,
    }),
    [actions, screen.vocab, screen.isDimmed, slideOver.issueKey, instructionsId],
  );
  const inFlight = model.lanes.reduce((sum, lane) => sum + lane.inFlight, 0);
  const project = screen.project;
  if (!project) return null;
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-col gap-3 bg-bg px-6 pt-3.5">
          <BoardHeader
            project={project}
            view={view}
            metrics={screen.metrics}
            sprint={screen.sprint}
            inFlight={inFlight}
          />
          <BoardToolbar
            people={screen.people}
            facets={screen.facets}
            quickFilters={screen.quickFilters}
            laneLabel={screen.laneLabel}
            lqlSources={screen.lqlSources}
            lqlError={screen.filterError ? screen.filterError.message : null}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">
          <BoardContext.Provider value={shared}>
            <BoardGrid model={model} kanban={screen.kanban} />
          </BoardContext.Provider>
        </div>
        <p id={instructionsId} hidden>
          Press Enter to open the issue. Press space to pick the card up, the arrow keys to move it,
          space again to drop it and Escape to put it back.
        </p>
        <BoardAnnouncer />
        <BoardVerdicts model={model} />
      </div>
      <IssueSlideOver issueKey={slideOver.issueKey} onClose={slideOver.close} />
    </div>
  );
}

/** The Board: Scrum or Kanban, matching the Board mock, with live updates over the socket. */
export default function BoardScreen({ projectKey }: WorkScreenProps) {
  const screen = useBoardScreen(projectKey);
  if (screen.isPending) {
    return (
      <div className="flex flex-col gap-3 px-6 pt-3.5" aria-busy="true">
        <Skeleton className="h-4 w-60" />
        <Skeleton className="h-7 w-80" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (screen.error) {
    return (
      <EmptyState
        title="The board did not load"
        description={screen.error.message}
        action={<Button onClick={screen.refetch}>Try again</Button>}
      />
    );
  }
  if (!screen.project) {
    return <EmptyState title="No project" description="Create a project to get a board." />;
  }
  if (!screen.view || !screen.model) {
    return (
      <EmptyState
        title={`${screen.project.name} has no board`}
        description="An admin can add one in Board settings."
      />
    );
  }
  return <BoardBody screen={screen} view={screen.view} model={screen.model} />;
}
