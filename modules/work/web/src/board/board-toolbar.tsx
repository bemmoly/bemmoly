import {
  AvatarStack,
  Dropdown,
  MenuItem,
  QuickFilterChip,
  QuickFilterRow,
  SearchInput,
  type StackPerson,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { useBoardFilterStore, type FacetKey, type QuickFilter } from '../hooks/board-filters.ts';
import type { BoardGrouping } from '../hooks/board-model.ts';
import type { LqlValueSources } from '../hooks/board-lql.ts';
import { LqlFilterBar } from './lql-filter-bar.tsx';

export interface FacetOption {
  id: string;
  label: string;
}

export interface BoardToolbarProps {
  people: readonly StackPerson[];
  facets: Readonly<Record<Exclude<FacetKey, 'people'>, readonly FacetOption[]>>;
  quickFilters: readonly QuickFilter[];
  /** What the board's own lanes group by, e.g. "Epic"; null when it has none. */
  laneLabel: string | null;
  lqlSources: LqlValueSources;
  lqlError: string | null;
}

const FACET_LABELS = { epics: 'Epic', types: 'Type', labels: 'Label' } as const;

function Facet({
  facet,
  options,
}: {
  facet: keyof typeof FACET_LABELS;
  options: readonly FacetOption[];
}) {
  const chosen = useBoardFilterStore((state) => state[facet]);
  const toggle = useBoardFilterStore((state) => state.toggle);
  const label = FACET_LABELS[facet];
  return (
    <Dropdown
      label={chosen.length > 0 ? `${label} · ${chosen.length}` : label}
      buttonProps={{ disabled: options.length === 0 }}
    >
      {options.map((option) => (
        <MenuItem
          key={option.id}
          keepOpen
          onSelect={() => toggle(facet, option.id)}
          icon={
            <Icon
              name="check"
              size={14}
              className={chosen.includes(option.id) ? 'text-ac' : 'invisible'}
            />
          }
        >
          {option.label}
        </MenuItem>
      ))}
    </Dropdown>
  );
}

/**
 * The filter row from the Board mock: search, the assignee avatars, the Epic, Type and Label
 * menus, the quick filter chips and "Group by" at the end. The search box opens the LQL bar.
 */
export function BoardToolbar({
  people,
  facets,
  quickFilters,
  laneLabel,
  lqlSources,
  lqlError,
}: BoardToolbarProps) {
  const filters = useBoardFilterStore();
  const [lqlOpen, setLqlOpen] = useState(filters.lql !== '');
  const grouping: BoardGrouping = laneLabel ? filters.grouping : 'none';
  return (
    <div className="flex flex-wrap items-center gap-2 gap-y-2.5 pb-3">
      {lqlOpen ? (
        <LqlFilterBar
          applied={filters.lql}
          onApply={filters.setLql}
          onClose={() => setLqlOpen(false)}
          sources={lqlSources}
          serverError={lqlError}
        />
      ) : (
        <SearchInput
          aria-label="Search this board"
          placeholder="Search this board"
          value={filters.search}
          onChange={(event) => filters.setSearch(event.target.value)}
          wrapperClassName="w-55 shrink-0"
          suffix={
            <button
              type="button"
              onClick={() => setLqlOpen(true)}
              title="Filter with LQL"
              className="ml-auto cursor-pointer border-0 bg-transparent p-0 font-mono text-11 font-medium text-tx6 hover:text-ac"
            >
              LQL
            </button>
          }
        />
      )}
      {people.length > 0 && (
        <AvatarStack
          people={people}
          size={30}
          max={5}
          ring="bg"
          selected={filters.people}
          onToggle={(id) => filters.toggle('people', id)}
          label="Filter by assignee"
          className="ml-1"
        />
      )}
      <Facet facet="epics" options={facets.epics} />
      <Facet facet="types" options={facets.types} />
      <Facet facet="labels" options={facets.labels} />
      <QuickFilterRow label="Quick filters" divider>
        {quickFilters.map((chip) => (
          <QuickFilterChip
            key={chip.id}
            active={filters.quick.includes(chip.id)}
            onToggle={() => filters.toggle('quick', chip.id)}
          >
            {chip.name}
          </QuickFilterChip>
        ))}
      </QuickFilterRow>
      <div className="ml-auto flex items-center gap-2 text-12h text-tx4">
        <span>Group by</span>
        <Dropdown
          label={grouping === 'lanes' && laneLabel ? laneLabel : 'None'}
          align="end"
          buttonProps={{ className: 'text-tx' }}
        >
          {laneLabel && (
            <MenuItem onSelect={() => filters.setGrouping('lanes')}>{laneLabel}</MenuItem>
          )}
          <MenuItem onSelect={() => filters.setGrouping('none')}>None</MenuItem>
        </Dropdown>
      </div>
    </div>
  );
}
