import { Checkbox, Dropdown, MenuItem, SearchInput, Switch } from '@bemmoly/ui';
import { useId, type ReactNode } from 'react';
import { useBacklogUi } from '../hooks/backlog-store.ts';
import type { EpicLook } from './model.ts';

interface Choice {
  id: string;
  name: string;
}

export interface BacklogToolbarProps {
  epics: readonly EpicLook[];
  types: readonly Choice[];
  people: readonly Choice[];
}

function count(label: string, n: number): ReactNode {
  return n > 0 ? `${label} · ${n}` : label;
}

function toggle(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/**
 * The filter row: a 220px search, the Epic, Type and Assignee menus and the
 * epics panel switch on the right, as in the mock. The Epic menu and the
 * panel set the same filter.
 */
export function BacklogToolbar({ epics, types, people }: BacklogToolbarProps) {
  const filters = useBacklogUi((state) => state.filters);
  const setFilters = useBacklogUi((state) => state.setFilters);
  const showEpics = useBacklogUi((state) => state.showEpics);
  const toggleEpics = useBacklogUi((state) => state.toggleEpics);
  const switchId = useId();
  const pickedEpic = epics.find((epic) => epic.id === filters.epicId);

  return (
    <div className="flex items-center gap-2">
      <SearchInput
        aria-label="Search backlog"
        placeholder="Search backlog"
        value={filters.text}
        onChange={(event) => setFilters({ text: event.target.value })}
        wrapperClassName="w-55"
      />
      <Dropdown label={pickedEpic ? `Epic · ${pickedEpic.title}` : 'Epic'}>
        <MenuItem onSelect={() => setFilters({ epicId: null })}>All epics</MenuItem>
        {epics.map((epic) => (
          <MenuItem
            key={epic.id}
            onSelect={() => setFilters({ epicId: filters.epicId === epic.id ? null : epic.id })}
            icon={<span aria-hidden className={`size-2 rounded-tick ${epic.colorClassName}`} />}
            hint={epic.key}
          >
            {epic.title}
          </MenuItem>
        ))}
      </Dropdown>
      <Dropdown label={count('Type', filters.typeIds.length)}>
        {types.map((type) => (
          <MenuItem
            key={type.id}
            keepOpen
            onSelect={() => setFilters({ typeIds: toggle(filters.typeIds, type.id) })}
            icon={
              <Checkbox
                aria-hidden
                readOnly
                tabIndex={-1}
                checked={filters.typeIds.includes(type.id)}
              />
            }
          >
            {type.name}
          </MenuItem>
        ))}
      </Dropdown>
      <Dropdown label={count('Assignee', filters.assigneeIds.length)}>
        {[{ id: 'none', name: 'Unassigned' }, ...people].map((person) => (
          <MenuItem
            key={person.id}
            keepOpen
            onSelect={() => setFilters({ assigneeIds: toggle(filters.assigneeIds, person.id) })}
            icon={
              <Checkbox
                aria-hidden
                readOnly
                tabIndex={-1}
                checked={filters.assigneeIds.includes(person.id)}
              />
            }
          >
            {person.name}
          </MenuItem>
        ))}
      </Dropdown>
      <div className="ml-auto flex items-center gap-2 text-12h text-tx4">
        <label htmlFor={switchId}>Show epics panel</label>
        <Switch id={switchId} checked={showEpics} onCheckedChange={toggleEpics} />
      </div>
    </div>
  );
}
