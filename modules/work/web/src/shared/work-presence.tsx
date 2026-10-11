import {
  HeaderPresence,
  PresenceFacepile,
  useRealtimePresence,
  type PresencePerson,
} from '@bemmoly/core-web';
import { avatarHue } from '@bemmoly/ui';
import { useMemo } from 'react';
import { usePeople } from '../hooks/issue-people.ts';
import { realtimeUrl } from './api.ts';

/** Where in a project someone can be: its board, its backlog, or one issue's page. */
export type WorkView = 'board' | 'backlog' | `issue:${string}`;

/** Where someone is, in the words the facepile's tooltip uses. */
export function whereLabel(view: string): string {
  if (view === 'board') return 'on the board';
  if (view === 'backlog') return 'on the backlog';
  if (view.startsWith('issue:')) return `viewing ${view.slice('issue:'.length)}`;
  return 'here';
}

/**
 * Who else is on this view of the project, in the page header. Only people who can open the
 * project are ever listed, since the server lets only them in; someone the people list cannot
 * name yet is left out rather than drawn as a stranger.
 */
export function WorkPresence({
  projectId,
  view,
}: {
  projectId: string | undefined;
  view: WorkView;
}) {
  const present = useRealtimePresence({
    url: realtimeUrl(),
    scope: projectId ? { kind: 'project', id: projectId } : null,
    view,
  });
  const { person } = usePeople();
  const people = useMemo(
    () =>
      present.flatMap((entry): PresencePerson[] => {
        const known = person(entry.userId);
        if (!known.id) return [];
        const where = whereLabel(entry.view);
        return [{ id: entry.userId, name: known.name, where, hue: avatarHue(entry.userId) }];
      }),
    [present, person],
  );
  return (
    <HeaderPresence>
      <PresenceFacepile people={people} />
    </HeaderPresence>
  );
}
