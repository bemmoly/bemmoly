import { Button } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useBacklogUi } from '../hooks/backlog-store.ts';
import { IssueFilterBar, type FilterOptions } from '../shared/issue-filter-bar.tsx';

export interface BacklogToolbarProps {
  options: FilterOptions;
}

/**
 * The Backlog's filter row: the same bar as the Board's, with a switch for the epics rail on
 * the right. The list stays grouped by sprint, the order planning happens in.
 */
export function BacklogToolbar({ options }: BacklogToolbarProps) {
  const showEpics = useBacklogUi((state) => state.showEpics);
  const toggleEpics = useBacklogUi((state) => state.toggleEpics);
  return (
    <IssueFilterBar
      label="Filter the backlog"
      options={options}
      extra={
        <Button
          size="xs"
          variant="ghost"
          aria-pressed={showEpics}
          icon={<Icon name="sidebar" size={14} />}
          onClick={toggleEpics}
          className="max-md:hidden"
        >
          Epics
        </Button>
      }
    />
  );
}
