import type { ImportContainerCounts, ImportContainerFilter } from '@bemmoly/shared';
import { SearchInput, SegmentedControl } from '@bemmoly/ui';
import type { KeyboardEvent } from 'react';
import type { ContainerChooser } from '../../hooks/use-container-chooser.ts';
import { count } from './import-words.ts';

/** The chooser's filters; `attention` is Options' own, never offered here. */
const FILTERS: [keyof ImportContainerCounts, string][] = [
  ['all', 'All'],
  ['new', 'Not imported'],
  ['imported', 'Imported before'],
  ['noaccess', 'No access'],
  ['selected', 'Selected'],
];

/** All and Selected always show; another filter only while it has rows (or is chosen). */
export function filterOptions(
  counts: ImportContainerCounts | undefined,
  current: ImportContainerFilter,
) {
  return FILTERS.filter(
    ([value]) =>
      value === 'all' || value === 'selected' || value === current || (counts?.[value] ?? 0) > 0,
  ).map(([value, label]) => ({
    value,
    label: (
      <span className="inline-flex items-center gap-1.5">
        {label}
        <span className="text-tx-3 tabular-nums">{count(counts?.[value] ?? 0)}</span>
      </span>
    ),
  }));
}

/** Search (Esc clears it, Down moves into the list) and the filters with their counts. */
export function ChooserToolbar({ chooser }: { chooser: ContainerChooser }) {
  const { nouns } = chooser;
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && chooser.text) {
      event.preventDefault();
      event.stopPropagation();
      chooser.clearSearch();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      chooser.focusList();
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput
        aria-label={`Search ${nouns.containers}`}
        placeholder={`Search ${count(chooser.total)} ${nouns.containers}`}
        value={chooser.text}
        onChange={(event) => chooser.setText(event.target.value)}
        onKeyDown={onKeyDown}
        className="min-w-0"
        wrapperClassName="min-w-50 flex-1"
      />
      <div className="max-w-full overflow-x-auto">
        <SegmentedControl
          size="sm"
          aria-label="Show"
          value={chooser.filter}
          onChange={chooser.setFilter}
          options={filterOptions(chooser.counts, chooser.filter)}
        />
      </div>
    </div>
  );
}
