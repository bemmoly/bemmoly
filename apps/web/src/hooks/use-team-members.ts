import { queryKeys } from '@bemmoly/api-client';
import { avatarHue, type AvatarHue } from '@bemmoly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { toast } from '../lib/toast.ts';
import { useDirectory } from './use-directory.ts';
import type { TeamCardView } from './use-teams.ts';
import { useUserSearch } from './use-user-search.ts';

export interface TeamMemberRow {
  userId: string;
  name: string;
  email: string;
  hue: AvatarHue;
  isLead: boolean;
}

/** "Manage members": who is on the team, adding people by search and removing them. */
export function useTeamMembers(team: TeamCardView) {
  const queryClient = useQueryClient();
  const { directory } = useDirectory();
  const searchPeople = useUserSearch({ exclude: 'deactivated' });
  const members = useQuery({
    queryKey: queryKeys.teams.members(team.id),
    queryFn: () => api.teams.members(team.id),
  });
  const rows: TeamMemberRow[] = (members.data?.items ?? []).flatMap((member) => {
    const user = directory.byId.get(member.userId);
    return user
      ? [
          {
            userId: user.id,
            name: user.name,
            email: user.email,
            hue: avatarHue(user.id),
            isLead: user.id === team.leadUserId,
          },
        ]
      : [];
  });
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() }),
    ]);
  const add = useMutation({
    mutationFn: (userId: string) => api.teams.addMember(team.id, userId),
    onSuccess: async (_, userId) => {
      await refresh();
      toast(`${directory.byId.get(userId)?.name ?? 'Person'} added to ${team.name}`);
    },
  });
  const remove = useMutation({
    mutationFn: (row: TeamMemberRow) => api.teams.removeMember(team.id, row.userId),
    onSuccess: async (_, row) => {
      await refresh();
      toast(`${row.name} removed from ${team.name}`);
    },
  });
  const memberIds = new Set(rows.map((row) => row.userId));
  return {
    query: members,
    rows,
    add,
    remove,
    /** People search without those already on the team. */
    searchPeople: async (query: string, signal: AbortSignal) =>
      (await searchPeople(query, signal)).filter((option) => !memberIds.has(option.value)),
  };
}
