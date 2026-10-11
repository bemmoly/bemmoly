import { FilterChipButton } from '@bemmoly/ui';
import { useState, type ReactNode } from 'react';
import type { LqlValueSources } from '../hooks/board-lql.ts';
import type { BoardGrouping } from '../hooks/board-model.ts';
import type { SavedFilters } from '../hooks/saved-filters.ts';
import { IssueFilterBar, type FilterOptions } from '../shared/issue-filter-bar.tsx';
import { useIssueFilters } from '../shared/issue-filters.ts';
import { LqlFilterBar } from './lql-filter-bar.tsx';
import { SavedFiltersMenu } from './saved-filters-menu.tsx';

export interface BoardToolbarProps {
  options: FilterOptions;
  /** What the board's own lanes group by, e.g. "Epic"; null when it has none. */
  laneLabel: string | null;
  grouping: BoardGrouping;
  onGrouping: (grouping: BoardGrouping) => void;
  lqlSources: LqlValueSources;
  lqlError: string | null;
  savedFilters: SavedFilters;
  /** The Display menu, at the row's end. */
  display?: ReactNode;
}

/**
 * The Board's filter row: the shared filter bar, with the query bar in place of search while
 * it is open, the saved filters, Group set to the board's lanes or None, and Display.
 */
export function BoardToolbar({
  options,
  laneLabel,
  grouping,
  onGrouping,
  lqlSources,
  lqlError,
  savedFilters,
  display,
}: BoardToolbarProps) {
  const { filters, setQuery } = useIssueFilters();
  const [lqlOpen, setLqlOpen] = useState(filters.lql !== '');
  /** Remounts the query bar so a saved filter's query replaces what was being typed. */
  const [barKey, setBarKey] = useState(0);
  const applySaved = (query: string) => {
    setQuery(query);
    setLqlOpen(true);
    setBarKey((key) => key + 1);
  };
  return (
    <IssueFilterBar<BoardGrouping>
      label="Filter this board"
      options={options}
      display={display}
      searchSlot={
        lqlOpen ? (
          <div className="min-w-80 flex-1">
            <LqlFilterBar
              key={barKey}
              applied={filters.lql}
              onApply={(query) => setQuery(query)}
              onClose={() => setLqlOpen(false)}
              sources={lqlSources}
              serverError={lqlError}
            />
          </div>
        ) : undefined
      }
      savedViews={
        <>
          {!lqlOpen && (
            <FilterChipButton icon="code" onClick={() => setLqlOpen(true)} title="Filter with LQL">
              Query
            </FilterChipButton>
          )}
          <SavedFiltersMenu filters={savedFilters} applied={filters.lql} onApply={applySaved} />
        </>
      }
      {...(laneLabel
        ? {
            group: {
              options: [
                { value: 'lanes' as const, label: laneLabel },
                { value: 'none' as const, label: 'None' },
              ],
              value: grouping,
              onChange: onGrouping,
            },
          }
        : {})}
    />
  );
}
