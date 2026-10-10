import { SearchInput, SegmentedControl } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { ProjectLayout, ProjectSegment, ProjectsViewState } from './projects-view.ts';

export interface ProjectCounts {
  all: number;
  starred: number;
  archived: number;
}

const count = (label: string, n: number) => (
  <span className="tabular-nums">
    {label}
    {n > 0 && <span className="text-tx-3"> · {n}</span>}
  </span>
);

/** Search, the All / Starred / Archived segments and the list or grid toggle (kit `.tool`). */
export function ProjectsToolbar({
  view,
  counts,
  onChange,
}: {
  view: ProjectsViewState;
  counts: ProjectCounts;
  onChange: (patch: Partial<ProjectsViewState>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput
        aria-label="Search projects"
        placeholder="Search projects…"
        wrapperClassName="w-full sm:w-65"
        value={view.q}
        onChange={(event) => onChange({ q: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && view.q) {
            event.stopPropagation();
            onChange({ q: '' });
          }
        }}
      />
      <SegmentedControl<ProjectSegment>
        size="sm"
        aria-label="Show"
        value={view.segment}
        onChange={(segment) => onChange({ segment })}
        options={[
          { value: 'all', label: count('All', counts.all) },
          { value: 'starred', label: count('Starred', counts.starred) },
          { value: 'archived', label: count('Archived', counts.archived) },
        ]}
      />
      <SegmentedControl<ProjectLayout>
        size="sm"
        aria-label="Layout"
        className="ml-auto max-sm:hidden"
        value={view.layout}
        onChange={(layout) => onChange({ layout })}
        options={[
          {
            value: 'list',
            label: (
              <span className="flex h-4 items-center" title="List">
                <Icon name="list" size={14} />
                <span className="sr-only">List</span>
              </span>
            ),
          },
          {
            value: 'grid',
            label: (
              <span className="flex h-4 items-center" title="Grid">
                <Icon name="grid" size={14} />
                <span className="sr-only">Grid</span>
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
