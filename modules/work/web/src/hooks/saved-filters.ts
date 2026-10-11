import { queryKeys } from '@bemmoly/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { SavedFilter } from '../../../shared/index.ts';
import { savedFilterKeys } from '../api/index.ts';
import { api } from '../shared/index.ts';
import { useTeams } from './projects-list.ts';

export interface SaveFilterInput {
  name: string;
  query: string;
  /** The one team it is shared with, or null to keep it private. */
  teamId: string | null;
}

export interface TeamChoice {
  id: string;
  name: string;
}

/**
 * The saved LQL filters a project's board offers: the person's own, which they
 * can rename and delete, and those other people shared with one of their
 * teams. A filter is saved for the project with the query the board has applied,
 * private or shared with one team the person belongs to.
 */
export function useSavedFilters(project: { id: string; key: string } | undefined) {
  const queryClient = useQueryClient();
  const projectKey = project?.key ?? '';
  const me = useQuery({ queryKey: queryKeys.me(), queryFn: () => api.auth.me() });
  const teams = useTeams();
  const list = useQuery({
    queryKey: savedFilterKeys.list(projectKey),
    queryFn: () => api.work.filters.list(projectKey),
    enabled: Boolean(project),
  });

  const meId = me.data?.user.id;
  const myTeamIds = me.data?.user.teamIds;
  const derived = useMemo(() => {
    const items = list.data ?? [];
    const names = new Map((teams.data?.items ?? []).map((team) => [team.id, team.name]));
    const myTeams: TeamChoice[] = (myTeamIds ?? []).flatMap((id) =>
      names.has(id) ? [{ id, name: names.get(id) as string }] : [],
    );
    return {
      mine: items.filter((filter) => filter.ownerId === meId),
      shared: items.filter((filter) => filter.ownerId !== meId),
      myTeams,
      /** "Only you", or the team it is shared with. */
      audience: (filter: SavedFilter) => {
        const [teamId] = filter.sharedWith;
        if (!teamId) return 'Only you';
        return `Shared with ${names.get(teamId) ?? 'a team'}`;
      },
    };
  }, [list.data, teams.data, meId, myTeamIds]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: savedFilterKeys.all() });
  const save = useMutation({
    mutationFn: ({ name, query, teamId }: SaveFilterInput) =>
      api.work.filters.create({
        name: name.trim(),
        query,
        projectId: project?.id,
        sharedWith: teamId ? [teamId] : [],
      }),
    onSuccess: refresh,
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.work.filters.update(id, { name: name.trim() }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.work.filters.remove(id),
    onSuccess: refresh,
  });

  return { ...derived, isPending: list.isPending, error: list.error, save, rename, remove };
}

export type SavedFilters = ReturnType<typeof useSavedFilters>;
