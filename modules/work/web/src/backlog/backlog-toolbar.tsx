import type { BacklogSortRule } from '@bemmoly/module-work/shared';
import type { LqlFieldCatalog } from '@bemmoly/shared';
import { Button, FilterChipButton, Tag } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { LqlFilterBar } from '../board/lql-filter-bar.tsx';
import type { LqlValueSources } from '../hooks/board-lql.ts';
import { useBacklogUi } from '../hooks/backlog-store.ts';
import { sortRuleLabel } from '../settings/model/labels.ts';
import { IssueFilterBar, type FilterOptions } from '../shared/issue-filter-bar.tsx';
import { useIssueFilters } from '../shared/issue-filters.ts';

export interface BacklogToolbarProps {
  options: FilterOptions;
  lqlSources: LqlValueSources;
  lqlCatalog: LqlFieldCatalog;
  /** The server's word on an applied query it could not run. */
  lqlError: string | null;
  /** The board's sort rules, which order every list; empty keeps rank order. */
  sortRules: readonly BacklogSortRule[];
}

/**
 * The Backlog's filter row: the same bar as the Board's, the query bar in place of search while
 * it is open, the sort rules in force, and a switch for the epics rail on the right. The list
 * stays grouped by sprint, the order planning happens in.
 */
export function BacklogToolbar({
  options,
  lqlSources,
  lqlCatalog,
  lqlError,
  sortRules,
}: BacklogToolbarProps) {
  const showEpics = useBacklogUi((state) => state.showEpics);
  const toggleEpics = useBacklogUi((state) => state.toggleEpics);
  const { filters, setQuery } = useIssueFilters();
  const [lqlOpen, setLqlOpen] = useState(filters.lql !== '');
  const sortedBy = sortRules.map(sortRuleLabel).join(', then ');
  return (
    <IssueFilterBar
      label="Filter the backlog"
      options={options}
      searchSlot={
        lqlOpen ? (
          <div className="min-w-80 flex-1">
            <LqlFilterBar
              applied={filters.lql}
              onApply={(query) => setQuery(query)}
              onClose={() => setLqlOpen(false)}
              sources={lqlSources}
              catalog={lqlCatalog}
              serverError={lqlError}
            />
          </div>
        ) : undefined
      }
      savedViews={
        !lqlOpen && (
          <FilterChipButton icon="code" onClick={() => setLqlOpen(true)} title="Filter with LQL">
            Query
          </FilterChipButton>
        )
      }
      extra={
        <>
          {sortedBy && (
            <Tag size="md" title={`Sorted by ${sortedBy}`} className="max-w-64 truncate">
              Sorted by {sortedBy}
            </Tag>
          )}
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
        </>
      }
    />
  );
}
