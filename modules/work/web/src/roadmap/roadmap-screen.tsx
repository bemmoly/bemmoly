import type { Project, RoadmapView } from '@bemmoly/module-work/shared';
import { HeaderActions, useRecordRecent } from '@bemmoly/core-web';
import { Button, dayOfIso } from '@bemmoly/ui';
import { useState } from 'react';
import { CreateIssueDialog } from '../create/create-issue-dialog.tsx';
import { workPaths } from '../hooks/issue-navigation.ts';
import { useRoadmapData } from '../hooks/roadmap-data.ts';
import { useRoadmapScreen } from '../hooks/roadmap-screen.ts';
import { IssueSlideOver } from '../issue/index.ts';
import { useAiEnabled } from '../issue/issue-ai-summary.tsx';
import type { WorkScreenProps } from '../routes.tsx';
import { useProject } from '../shared/use-project.ts';
import { RoadmapSkeleton } from '../skeletons/roadmap-skeleton.tsx';
import { ForecastPanel } from './forecast-panel.tsx';
import { ForecastStrip } from './forecast-strip.tsx';
import { RoadmapRowContext } from './roadmap-context.ts';
import {
  RoadmapError,
  RoadmapFilteredOut,
  RoadmapNoProject,
  RoadmapNothing,
} from './roadmap-empty.tsx';
import { RoadmapTimeline } from './roadmap-timeline.tsx';
import { RoadmapToolbar } from './roadmap-toolbar.tsx';

/*
 * The Roadmap (docs/design/premium/interaction/roadmap.md): epics and versions on a timeline
 * with their forecasts, for one project beside its Board and Backlog or across every project
 * the person can open. Rescheduling is a drag or the arrow keys; the forecast opens beside it.
 */

function NewEpic({ projectKey }: { projectKey: string | undefined }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <HeaderActions>
        <Button variant="primary" onClick={() => setOpen(true)}>
          New epic
        </Button>
      </HeaderActions>
      <CreateIssueDialog
        open={open}
        onClose={() => setOpen(false)}
        projectKey={projectKey}
        level="epic"
      />
    </>
  );
}

function RoadmapBody({
  view,
  oneProject,
  projectKey,
}: {
  view: RoadmapView;
  oneProject: boolean;
  projectKey: string | undefined;
}) {
  const screen = useRoadmapScreen(view, oneProject);
  const aiEnabled = useAiEnabled();
  const [creating, setCreating] = useState(false);
  const { state, rows } = screen;
  const variant = screen.docked ? 'docked' : 'overlay';
  const filtered = state.q !== '' || state.teamId !== null || !state.versions || state.done;
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <RoadmapToolbar
          view={view}
          state={state}
          oneProject={oneProject}
          searchRef={screen.searchRef}
          onToday={screen.goToday}
        />
        <ForecastStrip
          items={screen.items}
          dependencies={view.dependencies}
          today={dayOfIso(view.today)}
          onOpen={screen.shared.openForecast}
        />
        {rows.length > 0 ? (
          <RoadmapRowContext.Provider value={screen.shared}>
            <RoadmapTimeline
              view={view}
              rows={rows}
              tops={screen.tops}
              height={screen.height}
              scrollerRef={screen.scrollerRef}
              axisKey={screen.axisKey}
              summary={screen.summary}
            />
          </RoadmapRowContext.Provider>
        ) : view.items.length > 0 && filtered ? (
          <RoadmapFilteredOut onClear={state.clearFilters} />
        ) : (
          <RoadmapNothing onCreate={() => setCreating(true)} />
        )}
        <p id={screen.shared.instructionsId} hidden>
          Press the left and right arrow keys to move it a day, with Shift a week, with Alt to move
          only its end. Press F for its forecast, Enter to open it.
        </p>
      </div>
      <ForecastPanel
        view={view}
        item={screen.forecastItem}
        onClose={() => state.openForecast(null)}
        onOpenForecast={screen.shared.openForecast}
        variant={variant}
        aiEnabled={aiEnabled}
      />
      <IssueSlideOver
        issueKey={screen.peek.issueKey}
        onClose={screen.peek.close}
        variant={variant}
        {...(screen.peek.previous ? { onPrevious: screen.peek.previous } : {})}
        {...(screen.peek.next ? { onNext: screen.peek.next } : {})}
      />
      <CreateIssueDialog
        open={creating}
        onClose={() => setCreating(false)}
        projectKey={projectKey}
        level="epic"
      />
    </div>
  );
}

function useRoadmapInShell(project: Project | undefined, oneProject: boolean) {
  useRecordRecent(
    oneProject && !project
      ? null
      : {
          id: `work.roadmap:${project?.key ?? 'all'}`,
          title: 'Roadmap',
          context: oneProject ? (project?.name ?? '') : 'All projects',
          path: workPaths.roadmap(oneProject ? project?.key : undefined),
          look: { kind: 'icon', icon: 'roadmap', moduleId: 'work' },
          group: 'Roadmaps',
        },
  );
}

export default function RoadmapScreen({ projectKey }: WorkScreenProps) {
  const data = useRoadmapData(projectKey);
  // A new epic goes to the project on screen, or the one the person used last.
  const { project: fallback } = useProject(undefined);
  useRoadmapInShell(data.project, data.oneProject);
  const createIn = data.oneProject ? data.project?.key : fallback?.key;
  if (data.isPending) return <RoadmapSkeleton />;
  if (data.oneProject && !data.project) return <RoadmapNoProject projectKey={projectKey ?? ''} />;
  if (!data.view) {
    return (
      <RoadmapError
        message={
          data.error ? `${data.error.message.replace(/\.$/, '')}.` : 'The server did not answer.'
        }
        onRetry={data.refetch}
      />
    );
  }
  return (
    <>
      <NewEpic projectKey={createIn} />
      <RoadmapBody view={data.view} oneProject={data.oneProject} projectKey={createIn} />
    </>
  );
}
