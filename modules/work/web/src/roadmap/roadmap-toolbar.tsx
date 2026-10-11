import type { RoadmapView, RoadmapZoom } from '@bemmoly/module-work/shared';
import {
  Button,
  FilterBar,
  FilterChipButton,
  GroupSwitch,
  Menu,
  MenuGroup,
  MenuItem,
  SegmentedControl,
  Tooltip,
  type AppliedFilter,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { Ref } from 'react';
import type { RoadmapViewHandle } from '../hooks/roadmap-view.ts';

/*
 * The Roadmap's one filter row (the system's FilterBar): search, the team filter as a chip,
 * Show (versions, done items, team), then zoom, Today and, across projects, Group.
 */

const ZOOMS: readonly { value: RoadmapZoom; label: string }[] = [
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
  { value: 'quarters', label: 'Quarters' },
];

const GROUPS = [
  { value: 'project', label: 'Project' },
  { value: 'team', label: 'Team' },
  { value: 'none', label: 'None' },
] as const;

export interface RoadmapToolbarProps {
  view: RoadmapView;
  state: RoadmapViewHandle;
  oneProject: boolean;
  searchRef: Ref<HTMLInputElement>;
  onToday: () => void;
}

function ShowMenu({ view, state, oneProject }: Omit<RoadmapToolbarProps, 'searchRef' | 'onToday'>) {
  return (
    <Menu
      widthClassName="w-60"
      trigger={(props) => (
        <FilterChipButton {...props} icon="filter">
          Show
        </FilterChipButton>
      )}
    >
      <MenuGroup label="Items">
        <MenuItem
          kind="checkbox"
          keepOpen
          checked={state.versions}
          onSelect={() => state.setShow(!state.versions, state.done)}
        >
          Versions
        </MenuItem>
        <MenuItem
          kind="checkbox"
          keepOpen
          checked={state.done}
          onSelect={() => state.setShow(state.versions, !state.done)}
        >
          Done and released
        </MenuItem>
      </MenuGroup>
      {!oneProject && view.teams.length > 0 && (
        <MenuGroup label="Team" separated>
          <MenuItem
            kind="radio"
            checked={state.teamId === null}
            onSelect={() => state.setTeam(null)}
          >
            Every team
          </MenuItem>
          {view.teams.map((team) => (
            <MenuItem
              key={team.id}
              kind="radio"
              checked={state.teamId === team.id}
              onSelect={() => state.setTeam(team.id)}
            >
              {team.name}
            </MenuItem>
          ))}
        </MenuGroup>
      )}
    </Menu>
  );
}

export function RoadmapToolbar({
  view,
  state,
  oneProject,
  searchRef,
  onToday,
}: RoadmapToolbarProps) {
  const team = view.teams.find((entry) => entry.id === state.teamId);
  const applied: AppliedFilter[] = [
    ...(team
      ? [
          {
            id: 'team',
            label: team.name,
            description: `Team is ${team.name}`,
            icon: <Icon name="people" size={14} />,
            onRemove: () => state.setTeam(null),
          },
        ]
      : []),
    ...(state.done
      ? [
          {
            id: 'done',
            label: 'Done shown',
            description: 'Done epics and released versions are shown',
            onRemove: () => state.setShow(state.versions, false),
          },
        ]
      : []),
  ];
  return (
    <FilterBar
      search={{
        label: 'Filter the roadmap',
        placeholder: 'Filter epics…',
        value: state.q,
        onChange: state.setQuery,
      }}
      searchRef={searchRef}
      applied={applied}
      onClearAll={state.clearFilters}
      filterMenu={<ShowMenu view={view} state={state} oneProject={oneProject} />}
      extra={
        <>
          <SegmentedControl
            size="sm"
            aria-label="Zoom"
            options={ZOOMS}
            value={state.zoom}
            onChange={state.setZoom}
          />
          <Tooltip label="Scroll to today" keys="T">
            <Button size="sm" variant="ghost" onClick={onToday}>
              Today
            </Button>
          </Tooltip>
        </>
      }
      {...(oneProject
        ? {}
        : {
            group: <GroupSwitch options={GROUPS} value={state.group} onChange={state.setGroup} />,
          })}
    />
  );
}
