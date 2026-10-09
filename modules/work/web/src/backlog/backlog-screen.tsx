import type { Sprint } from '@bemmoly/module-work/shared';
import { Button, EmptyState, PageHeader, useToast } from '@bemmoly/ui';
import { useCallback, useMemo, useState } from 'react';
import { useBacklogScreen } from '../hooks/backlog-screen.ts';
import { useSprintActions } from '../hooks/backlog-sprints.ts';
import { keepLinksInApp } from '../hooks/issue-navigation.ts';
import { useBacklogUi } from '../hooks/backlog-store.ts';
import { IssueSlideOver } from '../issue/index.ts';
import { ProjectSwitcher } from '../projects/index.ts';
import type { WorkScreenProps } from '../routes.tsx';
import { BacklogContainersSkeleton } from '../skeletons/backlog-skeleton.tsx';
import { LineSkeleton } from '../skeletons/parts.tsx';
import { BacklogEpics } from './backlog-epics.tsx';
import { BacklogToolbar } from './backlog-toolbar.tsx';
import { CompleteSprintDialog } from './complete-sprint-dialog.tsx';
import { DragOverlay } from './drag-overlay.tsx';
import { BACKLOG_ID, nextSprintName, points } from './model.ts';
import { ProjectNav } from './project-nav.tsx';
import { SprintDialog } from './sprint-dialog.tsx';
import { SprintSection } from './sprint-section.tsx';

type Dialog = { kind: 'start' | 'edit' | 'complete'; sprintId: string } | null;

/**
 * The Backlog at /work/backlog/PLT: the project sidebar, the header with the
 * filter row, the epics panel and the sprint containers above the backlog,
 * as the Backlog mock lays them out.
 */
export default function BacklogScreen({ projectKey: pathKey }: WorkScreenProps) {
  const screen = useBacklogScreen(pathKey);
  const projectKey = screen.project?.key ?? '';
  const actions = useSprintActions(projectKey);
  const { show } = useToast();
  const showEpics = useBacklogUi((state) => state.showEpics);
  const epicFilter = useBacklogUi((state) => state.filters.epicId);
  const dragging = useBacklogUi((state) => state.drag !== null);
  const openKey = useBacklogUi((state) => state.openKey);
  const setOpenKey = useBacklogUi((state) => state.setOpenKey);
  const [dialog, setDialog] = useState<Dialog>(null);

  const sprints = screen.containers.flatMap((c) => (c.sprint ? [c.sprint] : []));
  const newSprintName = nextSprintName(projectKey, sprints);
  const epics = useMemo(() => [...screen.lookups.epics.values()], [screen.lookups.epics]);
  const epicTypeId = screen.epicTypeId;

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
      <ProjectNav project={screen.project} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-col gap-3 px-6 pt-3.5 pb-3">
          <PageHeader
            breadcrumbs={[
              { label: 'Projects' },
              {
                label: screen.project?.name ?? <LineSkeleton width={84} size="text-12h" bar={8} />,
              },
              { label: 'Backlog' },
            ]}
            title="Backlog"
            actions={
              <>
                <ProjectSwitcher screen="backlog" projectKey={projectKey || pathKey} />
                <Button loading={actions.create.isPending} onClick={createSprint}>
                  Create sprint
                </Button>
              </>
            }
          />
          <BacklogToolbar epics={epics} types={screen.standardTypes} people={screen.people} />
        </div>
        <div className="flex min-h-0 flex-1">
          {showEpics && (
            <BacklogEpics
              epics={epics}
              loading={screen.isPending}
              {...(epicTypeId ? { onCreate: createIssue(null, epicTypeId) } : {})}
            />
          )}
          <div
            ref={screen.scrollRef}
            className={`min-w-0 flex-1 overflow-auto px-6 pb-10 ${dragging ? 'select-none' : ''}`}
          >
            <div className="min-w-220">
              {screen.isPending && <BacklogContainersSkeleton />}
              {screen.error &&
                (screen.backlog ? (
                  <p role="status" className="m-0 pt-4 text-12h text-warn-fg">
                    The backlog could not refresh, so it may be out of date. {screen.error.message}
                  </p>
                ) : (
                  <EmptyState title="The backlog did not load" description={screen.error.message} />
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
          </div>
        </div>
      </div>
      {/* Over the page: beside it the list would lose the width its rows need. */}
      <IssueSlideOver issueKey={openKey} onClose={() => setOpenKey(null)} variant="overlay" />
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
