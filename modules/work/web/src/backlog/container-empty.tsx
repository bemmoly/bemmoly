import { Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useBacklogUi } from '../hooks/backlog-store.ts';
import { useIssueFilters } from '../shared/issue-filters.ts';

export interface ContainerEmptyProps {
  /** Filters are on: the container has issues, none of them match. */
  filtered: boolean;
  /** A sprint rather than the backlog. */
  sprint: boolean;
  containerId: string;
}

/**
 * A sprint or the backlog with no rows to show: what it is and the one thing to do next, at
 * the small size so the containers below stay in view. Rows still drop onto it.
 */
export function ContainerEmpty({ filtered, sprint, containerId }: ContainerEmptyProps) {
  const { clear } = useIssueFilters();
  const setCreatingIn = useBacklogUi((state) => state.setCreatingIn);
  const create = (
    <Button
      size="xs"
      icon={<Icon name="plus" size={12} />}
      onClick={() => setCreatingIn(containerId)}
    >
      Create issue
    </Button>
  );
  if (filtered)
    return (
      <EmptyState
        size="sm"
        icon={<Icon name="filter" />}
        title="No issues here match the filters"
        action={
          <Button size="xs" onClick={clear}>
            Clear filters
          </Button>
        }
        className="border-b border-line-2"
      />
    );
  return (
    <EmptyState
      size="sm"
      icon={<Icon name={sprint ? 'sprint' : 'backlog'} />}
      title={sprint ? 'Plan this sprint' : 'The backlog is empty'}
      description={
        sprint
          ? 'Drag issues here from the backlog, or create one in the sprint.'
          : 'Capture the work that comes next; sprints are planned from here.'
      }
      action={create}
      className="border-b border-line-2"
    />
  );
}
