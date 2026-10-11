import { Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { navigateTo, workPaths } from '../hooks/issue-navigation.ts';

/*
 * What the Roadmap says in place of its timeline: nothing planned yet, filters that hide
 * everything, a load that failed, or a project the person cannot see.
 */

export function RoadmapNothing({ onCreate }: { onCreate: (() => void) | null }) {
  return (
    <EmptyState
      icon={<Icon name="roadmap" />}
      title="No epics or versions yet"
      description="Epics and versions show here on a timeline, each with a forecast of when it lands. Create an epic and give it a target date to start."
      action={
        onCreate ? (
          <Button variant="primary" onClick={onCreate}>
            New epic
          </Button>
        ) : undefined
      }
    />
  );
}

export function RoadmapFilteredOut({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState
      icon={<Icon name="filter" />}
      title="Nothing matches these filters"
      description="Clear a filter or show done items to see more of the roadmap."
      action={<Button onClick={onClear}>Clear filters</Button>}
    />
  );
}

export function RoadmapError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <EmptyState
      icon={<Icon name="warning" />}
      title="The roadmap did not load"
      description={`${message} Nothing was changed; your epics and dates are as they were.`}
      action={<Button onClick={onRetry}>Try again</Button>}
    />
  );
}

export function RoadmapNoProject({ projectKey }: { projectKey: string }) {
  return (
    <EmptyState
      icon={<Icon name="project" />}
      title="No project"
      description={`There is no project ${projectKey.toUpperCase()} you can see.`}
      action={
        <Button variant="primary" onClick={() => navigateTo(workPaths.roadmap())}>
          Open the full roadmap
        </Button>
      }
    />
  );
}
