import { useMemo } from 'react';
import type { BacklogToolbarProps } from '../backlog/backlog-toolbar.tsx';
import type { BacklogData } from './backlog-data.ts';
import type { LqlValueSources } from './board-lql.ts';

type QueryBarInput = Pick<
  BacklogData,
  | 'people'
  | 'standardTypes'
  | 'backlog'
  | 'containers'
  | 'project'
  | 'q'
  | 'error'
  | 'lqlCatalog'
  | 'sortRules'
>;

/**
 * What the Backlog's query bar completes from and shows: the names the screen already loaded,
 * the project's fields, the sort rules in force, and the server's word on a query it refused.
 */
export function useBacklogQueryBar(data: QueryBarInput): Omit<BacklogToolbarProps, 'options'> {
  const { people, standardTypes, backlog, containers, project } = data;
  const lqlSources = useMemo<LqlValueSources>(
    () => ({
      users: people.map((person) => person.name),
      issueTypes: standardTypes.map((type) => type.name),
      epics: (backlog?.epics ?? []).map((epic) => epic.key),
      sprints: containers.flatMap((container) => (container.sprint ? [container.sprint.name] : [])),
      projects: project ? [project.key] : [],
    }),
    [people, standardTypes, backlog?.epics, containers, project],
  );
  return {
    lqlSources,
    lqlCatalog: data.lqlCatalog,
    lqlError: data.q && data.error ? data.error.message : null,
    sortRules: data.sortRules,
  };
}
