import {
  Avatar,
  epicFill,
  FilterBar,
  FilterChipButton,
  GroupSwitch,
  Menu,
  MenuGroup,
  MenuItem,
  TypeGlyph,
  UnassignedAvatar,
  type AppliedFilter,
  type AvatarHue,
  type EpicColor,
  type GroupOption,
  type IssueTypeRef,
} from '@bemmoly/ui';
import { useEffect, useRef, type ReactNode } from 'react';
import { FACETS, useIssueFilters, type FacetKey } from './issue-filters.ts';

/*
 * The filter row Board and Backlog share, over the one filter model in the address. Set
 * filters show as chips that remove themselves; the Filter menu adds them; "/" focuses search.
 */

export interface FilterOptions {
  people: readonly { id: string; name: string; hue?: AvatarHue }[];
  epics: readonly { id: string; name: string; color: EpicColor | null }[];
  types: readonly { id: string; name: string; look: IssueTypeRef }[];
  labels: readonly { id: string; name: string }[];
  quick: readonly { id: string; name: string }[];
}

export interface IssueFilterBarProps<G extends string> {
  /** Names the search field: "Filter this board". */
  label: string;
  options: FilterOptions;
  group?: { options: readonly GroupOption<G>[]; value: G; onChange: (value: G) => void };
  savedViews?: ReactNode;
  extra?: ReactNode;
  display?: ReactNode;
  /** Replaces the search box, e.g. with the query bar while it is open. */
  searchSlot?: ReactNode;
}

const FACET_NAMES: Record<FacetKey, string> = {
  assignee: 'Assignee',
  epic: 'Epic',
  type: 'Type',
  label: 'Label',
};

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

function useSlashToSearch() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || typing(event.target)) return;
      if (!ref.current) return;
      event.preventDefault();
      ref.current.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return ref;
}

export function IssueFilterBar<G extends string>({
  label,
  options,
  group,
  savedViews,
  extra,
  display,
  searchSlot,
}: IssueFilterBarProps<G>) {
  const api = useIssueFilters();
  const { filters } = api;
  const searchRef = useSlashToSearch();

  const nameOf = (facet: FacetKey, id: string): { name: string; icon?: ReactNode } => {
    if (facet === 'assignee') {
      if (id === 'none') return { name: 'Unassigned', icon: <UnassignedAvatar size={16} /> };
      const person = options.people.find((entry) => entry.id === id);
      const name = person?.name ?? 'Someone';
      return {
        name,
        icon: <Avatar name={name} size={16} {...(person?.hue ? { hue: person.hue } : {})} />,
      };
    }
    if (facet === 'epic') {
      if (id === 'none') return { name: 'No epic' };
      const epic = options.epics.find((entry) => entry.id === id);
      return {
        name: epic?.name ?? 'An epic',
        icon: (
          <i aria-hidden className={`size-2 rounded-[2.5px] ${epicFill(epic?.color ?? null)}`} />
        ),
      };
    }
    if (facet === 'type') {
      const type = options.types.find((entry) => entry.id === id);
      return {
        name: type?.name ?? 'A type',
        ...(type ? { icon: <TypeGlyph type={type.look} /> } : {}),
      };
    }
    return { name: options.labels.find((entry) => entry.id === id)?.name ?? 'A label' };
  };

  const applied: AppliedFilter[] = [
    ...filters.quick.map((id) => {
      const name = options.quick.find((entry) => entry.id === id)?.name ?? id;
      return {
        id: `quick:${id}`,
        label: name,
        description: name,
        onRemove: () => api.remove('quick', id),
      };
    }),
    ...FACETS.flatMap((facet) =>
      filters[facet].map((id) => {
        const { name, icon } = nameOf(facet, id);
        return {
          id: `${facet}:${id}`,
          label: name,
          description: `${FACET_NAMES[facet]} is ${name}`,
          ...(icon ? { icon } : {}),
          onRemove: () => api.remove(facet, id),
        };
      }),
    ),
    ...(filters.lql
      ? [
          {
            id: 'lql',
            label: filters.view ?? filters.lql,
            description: `Query: ${filters.lql}`,
            onRemove: () => api.setQuery(''),
          },
        ]
      : []),
  ];

  const facetItems = (facet: FacetKey, entries: readonly { id: string; name: string }[]) =>
    entries.map((entry) => {
      const { icon } = nameOf(facet, entry.id);
      return (
        <MenuItem
          key={`${facet}:${entry.id}`}
          keepOpen
          icon={icon}
          checked={filters[facet].includes(entry.id)}
          onSelect={() => api.toggle(facet, entry.id)}
        >
          {entry.name}
        </MenuItem>
      );
    });

  const filterMenu = (
    <Menu
      widthClassName="w-64 max-h-[min(480px,70vh)] overflow-y-auto"
      trigger={(props) => (
        <FilterChipButton {...props} icon="filter">
          Filter
        </FilterChipButton>
      )}
    >
      {options.quick.length > 0 && (
        <MenuGroup label="Quick filters">
          {options.quick.map((entry) => (
            <MenuItem
              key={entry.id}
              keepOpen
              checked={filters.quick.includes(entry.id)}
              onSelect={() => api.toggle('quick', entry.id)}
            >
              {entry.name}
            </MenuItem>
          ))}
        </MenuGroup>
      )}
      <MenuGroup label="Assignee" separated>
        {facetItems('assignee', [{ id: 'none', name: 'Unassigned' }, ...options.people])}
      </MenuGroup>
      {options.epics.length > 0 && (
        <MenuGroup label="Epic" separated>
          {facetItems('epic', [...options.epics, { id: 'none', name: 'No epic' }])}
        </MenuGroup>
      )}
      {options.types.length > 0 && (
        <MenuGroup label="Type" separated>
          {facetItems('type', options.types)}
        </MenuGroup>
      )}
      {options.labels.length > 0 && (
        <MenuGroup label="Label" separated>
          {facetItems('label', options.labels)}
        </MenuGroup>
      )}
    </Menu>
  );

  return (
    <FilterBar
      search={{ value: filters.q, onChange: api.setText, label, placeholder: 'Filter issues…' }}
      searchRef={searchRef}
      applied={applied}
      onClearAll={api.clear}
      filterMenu={filterMenu}
      savedViews={savedViews}
      extra={extra}
      group={group ? <GroupSwitch {...group} /> : undefined}
      display={display}
      searchSlot={searchSlot}
    />
  );
}
