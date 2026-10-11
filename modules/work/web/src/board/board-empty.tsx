import { openCreate } from '@bemmoly/core-web';
import { Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { navigateTo, workPaths } from '../hooks/issue-navigation.ts';

export interface BoardEmptyProps {
  projectKey: string;
  /** Cards the view holds before filters; above zero, the filters hid them all. */
  cards: number;
  kanban: boolean;
  sprintRunning: boolean;
  onClearFilters: () => void;
}

/**
 * What the board says in place of its lanes when it shows no card: filters hid them all, a
 * Kanban board is still empty, or a Scrum board has no sprint (or an empty one) running.
 */
export function BoardEmpty({
  projectKey,
  cards,
  kanban,
  sprintRunning,
  onClearFilters,
}: BoardEmptyProps) {
  if (cards > 0) {
    return (
      <EmptyState
        icon={<Icon name="filter" />}
        title="No issues match these filters"
        description="Clear a filter or two to see more of the board."
        action={<Button onClick={onClearFilters}>Clear filters</Button>}
      />
    );
  }
  if (kanban) {
    return (
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
    );
  }
  return (
    <EmptyState
      icon={<Icon name="sprint" />}
      title={sprintRunning ? 'Nothing in this sprint yet' : 'No sprint is running'}
      description={
        sprintRunning
          ? 'Plan the sprint from the backlog and its issues show up here.'
          : 'Start a sprint from the backlog and its issues show up here.'
      }
      action={
        <Button variant="primary" onClick={() => navigateTo(workPaths.backlog(projectKey))}>
          Open the backlog
        </Button>
      }
    />
  );
}
