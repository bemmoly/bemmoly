import type { Issue, Sprint } from '@bemmoly/module-work/shared';
import { HeaderActions } from '@bemmoly/core-web';
import { useBacklogPresence } from './backlog-presence.ts';
import { avatarHue, Button, EmptyState, useToast } from '@bemmoly/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { setSearchParams, useSearchParam } from '../shared/url-state.ts';
import { useIssueQuickActions } from '../hooks/issue-quick-actions.ts';
import { DOCKED_SLIDE_OVER_QUERY, useMediaQuery } from '../hooks/media-query.ts';
import { IssueActionsMenu, type MenuSprint } from '../shared/issue-actions-menu.tsx';
import type { FilterOptions } from '../shared/issue-filter-bar.tsx';
import { useIssueFilters } from '../shared/issue-filters.ts';
import { BacklogBulkBar } from './backlog-bulk-bar.tsx';
import { BacklogRowContext, type BacklogRowShared } from './backlog-row-context.ts';
import { useBacklogScreen } from '../hooks/backlog-screen.ts';
import { useSprintActions } from '../hooks/backlog-sprints.ts';
import { keepLinksInApp } from '../hooks/issue-navigation.ts';
import { useBacklogUi } from '../hooks/backlog-store.ts';
import { IssueSlideOver, useRememberIssueList } from '../issue/index.ts';
import type { WorkScreenProps } from '../routes.tsx';
import { BacklogContainersSkeleton } from '../skeletons/backlog-skeleton.tsx';
import { BacklogEpics } from './backlog-epics.tsx';
import { BacklogToolbar } from './backlog-toolbar.tsx';
import { CompleteSprintDialog } from './complete-sprint-dialog.tsx';
import { DragOverlay } from './drag-overlay.tsx';
import { BACKLOG_ID, backlogIssueOrder, nextSprintName, points } from './model.ts';
import { SprintDialog } from './sprint-dialog.tsx';
import { SprintSection } from './sprint-section.tsx';

type Dialog = { kind: 'start' | 'edit' | 'complete'; sprintId: string } | null;

/**
 * The Backlog at /work/backlog/PLT: the filter row, the epics panel and the sprint containers
 * above the backlog, as the Backlog mock lays them out. The frame's header holds the project,
 * the Board and Backlog tabs and Create sprint.
 */
export default function BacklogScreen({ projectKey: pathKey }: WorkScreenProps) {
  const screen = useBacklogScreen(pathKey);
  const projectKey = screen.project?.key ?? '';
  useBacklogPresence(screen.project);
  const actions = useSprintActions(projectKey);
  const { show } = useToast();
  const showEpics = useBacklogUi((state) => state.showEpics);
  const { filters } = useIssueFilters();
  const epicFilter =
    filters.epic.length === 1 && filters.epic[0] !== 'none' ? filters.epic[0] : null;
  const dragging = useBacklogUi((state) => state.drag !== null);
  const selectedIds = useBacklogUi((state) => state.selection.ids);
  const [dialog, setDialog] = useState<Dialog>(null);
  // "Complete sprint" on the Board lands here with ?complete=<sprint id> and opens the dialog.
  const completeId = useSearchParam('complete');
  const activeIds = screen.containers.filter((c) => c.sprint?.state === 'active').map((c) => c.id);
  const canComplete = completeId !== null && activeIds.includes(completeId);
  useEffect(() => {
    if (!canComplete || !completeId) return;
    setDialog({ kind: 'complete', sprintId: completeId });
    setSearchParams({ complete: null });
  }, [canComplete, completeId]);
  const quick = useIssueQuickActions();
  const docked = useMediaQuery(DOCKED_SLIDE_OVER_QUERY);
  const { peek, meId, lookups } = screen;
  const order = useMemo(() => backlogIssueOrder(screen.sections), [screen.sections]);
  useRememberIssueList(screen.project ? { label: 'Backlog', keys: order } : null);

  const sprints = screen.containers.flatMap((c) => (c.sprint ? [c.sprint] : []));
  const newSprintName = nextSprintName(projectKey, sprints);
  const epics = useMemo(() => [...screen.lookups.epics.values()], [screen.lookups.epics]);
  const epicTypeId = screen.epicTypeId;

  const moveTargets = useMemo<MenuSprint[]>(
    () => [
      ...screen.containers.flatMap((c) =>
        c.sprint && c.sprint.state !== 'closed' ? [{ id: c.sprint.id, name: c.sprint.name }] : [],
      ),
      { id: null, name: 'Backlog' },
    ],
    [screen.containers],
  );
  const options = useMemo<FilterOptions>(
    () => ({
      people: screen.people.map((person) => ({
        id: person.id,
        name: person.name,
        hue: person.id === meId ? ('accent' as const) : avatarHue(person.id),
      })),
      epics: epics.map((epic) => ({ id: epic.id, name: epic.title, color: epic.look })),
      types: screen.standardTypes.map((type) => ({
        id: type.id,
        name: type.name,
        look: lookups.types.get(type.id) ?? 'task',
      })),
      labels: [],
      quick: [
        { id: 'mine', name: 'Only my issues' },
        { id: 'blocked', name: 'Blocked' },
        { id: 'recent', name: 'Recently updated' },
      ],
    }),
    [screen.people, screen.standardTypes, epics, lookups.types, meId],
  );
  const keyOf = useMemo(
    () => new Map(screen.containers.flatMap((c) => c.issues.map((issue) => [issue.id, issue.key]))),
    [screen.containers],
  );
  const selectedKeys = selectedIds.flatMap((id) => {
    const key = keyOf.get(id);
    return key ? [key] : [];
  });
  const rowShared = useMemo<BacklogRowShared>(
    () => ({
      blocked: screen.backlog?.blocked ?? {},
      menu: (issue: Issue) => (
        <IssueActionsMenu
          issueKey={issue.key}
          assigneeId={issue.assigneeId}
          priority={issue.priority}
          sprintId={issue.sprintId}
          meId={meId}
          actions={quick}
          sprints={moveTargets}
          onOpen={() => peek.open(issue.key)}
          {...(selectedIds.includes(issue.id) ? { targets: selectedKeys } : {})}
        />
      ),
    }),
    [screen.backlog?.blocked, meId, quick, moveTargets, peek.open, selectedIds, keyOf],
  );

  const issueById = useCallback(
    (id: string) => screen.containers.flatMap((c) => c.issues).find((issue) => issue.id === id),
    [screen.containers],
  );
  const containerName = useCallback(
    (id: string) =>
      screen.containers.find((c) => c.id === id)?.sprint?.name ??
      (id === BACKLOG_ID ? 'the backlog' : 'this sprint'),
    [screen.containers],
  );

  const createSprint = () =>
    actions.create.mutate(newSprintName, {
      onError: (error) =>
        show({ tone: 'danger', title: 'No sprint was created', body: error.message }),
    });
  const createIssue = (sprint: Sprint | null, typeId: string | undefined) => (title: string) => {
    if (!screen.project || !typeId)
      return Promise.reject(new Error('This project has no issue types.'));
    return actions.createIssue.mutateAsync({
      projectId: screen.project.id,
      typeId,
      title,
      ...(sprint ? { sprintId: sprint.id } : {}),
      ...(epicFilter && typeId !== epicTypeId ? { parentId: epicFilter } : {}),
    });
  };

  if (!screen.isPending && !screen.project) {
    return (
      <EmptyState
        title="No project to plan"
        description={
          pathKey
            ? `There is no project ${pathKey.toUpperCase()} you can see.`
            : 'Create a project to plan its backlog.'
        }
      />
    );
  }

  const open = screen.containers.find((c) => c.id === dialog?.sprintId);
  return (
    <div className="flex min-h-0 flex-1" onClick={keepLinksInApp}>
      <HeaderActions>
        <Button loading={actions.create.isPending} onClick={createSprint}>
          Create sprint
        </Button>
      </HeaderActions>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <BacklogToolbar options={options} />
        <div className="flex min-h-0 flex-1">
          {showEpics && epicTypeId !== undefined && (
            <BacklogEpics
              epics={epics}
              loading={screen.isPending}
              onCreate={createIssue(null, epicTypeId)}
              className="max-md:hidden"
            />
          )}
          <div
            ref={screen.scrollRef}
            className={`min-w-0 flex-1 overflow-auto pb-24 ${dragging ? 'select-none' : ''}`}
          >
            <BacklogRowContext.Provider value={rowShared}>
              <div className="min-w-0">
                {screen.isPending && <BacklogContainersSkeleton />}
                {screen.error &&
                  (screen.backlog ? (
                    <p role="status" className="m-0 px-6 py-3 text-12 text-amber-tx">
                      The backlog could not refresh, so it may be out of date.{' '}
                      {screen.error.message}
                    </p>
                  ) : (
                    <EmptyState
                      title="The backlog did not load"
                      description={screen.error.message}
                      action={<Button onClick={() => void screen.refetch()}>Try again</Button>}
                    />
                  ))}
                {screen.sections.map(({ container, visible }) => (
                  <SprintSection
                    key={container.id}
                    container={container}
                    visible={visible}
                    filtered={screen.filtered}
                    lookups={screen.lookups}
                    handlers={screen.handlers}
                    entryId={screen.entryId}
                    scrollRef={screen.scrollRef}
                    onAction={() =>
                      container.sprint
                        ? setDialog({
                            kind: container.sprint.state === 'active' ? 'complete' : 'start',
                            sprintId: container.id,
                          })
                        : createSprint()
                    }
                    {...(container.sprint
                      ? { onMore: () => setDialog({ kind: 'edit', sprintId: container.id }) }
                      : {})}
                    onCreateIssue={createIssue(container.sprint, screen.defaultTypeId)}
                  />
                ))}
              </div>
            </BacklogRowContext.Provider>
          </div>
        </div>
      </div>
      <IssueSlideOver
        issueKey={peek.issueKey}
        onClose={peek.close}
        variant={docked ? 'docked' : 'overlay'}
        {...(peek.previous ? { onPrevious: peek.previous } : {})}
        {...(peek.next ? { onNext: peek.next } : {})}
      />
      <BacklogBulkBar keys={selectedKeys} meId={meId} sprints={moveTargets} actions={quick} />
      <DragOverlay
        previewRef={screen.previewRef}
        issueById={issueById}
        containerName={containerName}
      />
      {open?.sprint && dialog && dialog.kind !== 'complete' && (
        <SprintDialog
          mode={dialog.kind}
          sprint={open.sprint}
          cadenceDays={screen.cadenceDays}
          issueCount={open.issues.length}
          committedPoints={points(open.issues)}
          actions={actions}
          onClose={() => setDialog(null)}
        />
      )}
      {open?.sprint && dialog?.kind === 'complete' && (
        <CompleteSprintDialog
          container={open}
          future={sprints.filter((sprint) => sprint.state === 'future')}
          newSprintName={newSprintName}
          lookups={screen.lookups}
          actions={actions}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
